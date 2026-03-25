/**
 * World — the central registry of entities, component stores, queries, and systems.
 *
 * Session-scoped: each VGF session gets its own World instance.
 * No global mutable state — multiple Worlds in the same process are fully isolated.
 */
import {
  type EntityId,
  EntityPool,
  entityIndex,
  makeEntityId,
  entityGeneration,
  NULL_ENTITY,
} from "./Entity.js";
import { type ComponentClass, getComponentId } from "./Component.js";
import { SparseSet } from "./SparseSet.js";
import { QueryBuilder, type CachedQuery } from "./Query.js";
import type { SystemFn, SystemRecord, SystemError } from "./System.js";
import { type Command, CommandQueue } from "./CommandQueue.js";
import { DirtyTracker } from "../networking/DirtyTracker.js";
import { DeltaEncoder, type WorldDelta } from "../networking/DeltaEncoder.js";
import {
  captureSnapshot as captureSnapshotFn,
  applySnapshot as applySnapshotFn,
  type WorldSnapshot,
} from "../networking/Snapshot.js";

/** Callback type for component lifecycle hooks. */
type ComponentCallback = (eid: EntityId) => void;

/** Deferred operation types. */
interface DeferredOp {
  kind: "destroyEntity" | "addComponent" | "removeComponent";
  entityId?: EntityId;
  componentType?: ComponentClass;
  componentData?: Record<string, unknown>;
}

export class World {
  // ── Identity ──
  readonly sessionId: string;

  // ── Time ──
  time = 0;
  tickCount = 0;

  // ── Entity management ──
  private readonly entityPool = new EntityPool();
  private readonly parentMap = new Map<number, EntityId>();
  private readonly childrenMap = new Map<number, EntityId[]>();
  /** Maps entity index → full EntityId (with generation), for query results. */
  private readonly indexToEntity = new Map<number, EntityId>();

  // ── Component storage ──
  private readonly stores = new Map<number, SparseSet<unknown>>();
  /** Reverse map: SparseSet → ComponentClass (for serialisation). */
  private readonly storeTypeMap = new Map<SparseSet<unknown>, ComponentClass>();

  // ── Singleton storage ──
  private readonly singletons = new Map<number, unknown>();

  // ── Query cache ──
  private structuralVersion = 0;
  private readonly queryCache = new Map<string, CachedQuery>();

  // ── Systems ──
  private readonly systems: SystemRecord[] = [];
  private systemsSorted = false;

  // ── Deferred operations ──
  private readonly deferredOps: DeferredOp[] = [];
  private insideSystemExecution = false;

  // ── Tick errors ──
  private tickErrors: SystemError[] = [];

  // ── Command queue ──
  private readonly commandQueue = new CommandQueue();

  // ── Lifecycle hooks ──
  private readonly onAddedHooks = new Map<number, ComponentCallback[]>();
  private readonly onRemovedHooks = new Map<number, ComponentCallback[]>();

  // ── Dirty tracking (opt-in) ──
  private dirtyTracker: DirtyTracker | null = null;
  private dirtyTrackingEnabled = false;
  private readonly deltaEncoder = new DeltaEncoder();

  // ── Singleton type tracking (for serialisation) ──
  private readonly singletonTypes = new Map<number, ComponentClass>();

  constructor(options?: { sessionId?: string }) {
    this.sessionId = options?.sessionId ?? "";
  }

  /**
   * Assert that an entity ID refers to a currently alive entity.
   * Throws if the entity is dead or stale (recycled generation).
   */
  private assertAlive(id: EntityId): void {
    if (!this.entityPool.isAlive(id)) {
      throw new Error(
        `Entity ${id} is not alive (stale or destroyed reference)`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Entity API
  // ═══════════════════════════════════════════════════════

  /** Create an entity, optionally as a child of a parent. */
  createEntity(parent?: EntityId): EntityId {
    // Entity creation is always immediate — safe during system execution.
    // New entities won't appear in existing cached queries until structural
    // version increments and queries are re-evaluated.
    return this.createEntityImmediate(parent);
  }

  private createEntityImmediate(parent?: EntityId): EntityId {
    const id = this.entityPool.create();
    const idx = entityIndex(id);
    this.indexToEntity.set(idx, id);

    if (parent !== undefined && parent !== NULL_ENTITY) {
      this.setParentImmediate(id, parent);
    }
    this.structuralVersion++;

    if (this.dirtyTracker) {
      this.dirtyTracker.markCreated(id);
    }

    return id;
  }

  /** Destroy an entity and cascade to all children (depth-first). */
  destroyEntity(id: EntityId): void {
    if (this.insideSystemExecution) {
      this.deferredOps.push({ kind: "destroyEntity", entityId: id });
      return;
    }
    this.destroyEntityImmediate(id);
  }

  private destroyEntityImmediate(id: EntityId): void {
    if (!this.entityPool.isAlive(id)) return;

    const idx = entityIndex(id);

    // Cascade destroy children first (depth-first).
    const children = this.childrenMap.get(idx);
    if (children) {
      const childCopy = [...children];
      for (const child of childCopy) {
        this.destroyEntityImmediate(child);
      }
      this.childrenMap.delete(idx);
    }

    // Remove from parent's children list.
    const parentId = this.parentMap.get(idx);
    if (parentId !== undefined) {
      const parentIdx = entityIndex(parentId);
      const siblings = this.childrenMap.get(parentIdx);
      if (siblings) {
        const sibIdx = siblings.indexOf(id);
        if (sibIdx !== -1) siblings.splice(sibIdx, 1);
      }
      this.parentMap.delete(idx);
    }

    // Remove all components.
    for (const [compId, store] of this.stores) {
      if (store.has(idx)) {
        const hooks = this.onRemovedHooks.get(compId);
        if (hooks) {
          for (const hook of hooks) hook(id);
        }
        store.remove(idx);
      }
    }

    if (this.dirtyTracker) {
      this.dirtyTracker.markDestroyed(id);
    }

    this.entityPool.destroy(id);
    this.indexToEntity.delete(idx);
    this.structuralVersion++;
  }

  /** Check if an entity is alive. */
  isAlive(id: EntityId): boolean {
    return this.entityPool.isAlive(id);
  }

  /** Number of alive entities. */
  get entityCount(): number {
    return this.entityPool.count;
  }

  // ═══════════════════════════════════════════════════════
  //  Hierarchy API
  // ═══════════════════════════════════════════════════════

  setParent(childId: EntityId, parentId: EntityId): void {
    this.assertAlive(childId);
    this.assertAlive(parentId);
    this.setParentImmediate(childId, parentId);
  }

  private setParentImmediate(childId: EntityId, parentId: EntityId): void {
    // Prevent self-parenting.
    if (childId === parentId) {
      throw new Error("Cannot parent entity to itself");
    }

    // Prevent ancestor cycles: walk up from parentId, if we reach childId it's a cycle.
    let cursor: EntityId | null = parentId;
    while (cursor !== null && cursor !== undefined) {
      cursor = this.getParent(cursor);
      if (cursor === childId) {
        throw new Error("Cycle detected in entity hierarchy");
      }
    }

    const childIdx = entityIndex(childId);

    // Remove from old parent if any.
    const oldParent = this.parentMap.get(childIdx);
    if (oldParent !== undefined) {
      const oldParentIdx = entityIndex(oldParent);
      const siblings = this.childrenMap.get(oldParentIdx);
      if (siblings) {
        const sibIdx = siblings.indexOf(childId);
        if (sibIdx !== -1) siblings.splice(sibIdx, 1);
      }
    }

    // Set new parent.
    this.parentMap.set(childIdx, parentId);
    const parentIdx = entityIndex(parentId);
    let children = this.childrenMap.get(parentIdx);
    if (!children) {
      children = [];
      this.childrenMap.set(parentIdx, children);
    }
    children.push(childId);
  }

  removeParent(childId: EntityId): void {
    this.assertAlive(childId);
    const childIdx = entityIndex(childId);
    const parentId = this.parentMap.get(childIdx);
    if (parentId === undefined) return;

    const parentIdx = entityIndex(parentId);
    const siblings = this.childrenMap.get(parentIdx);
    if (siblings) {
      const sibIdx = siblings.indexOf(childId);
      if (sibIdx !== -1) siblings.splice(sibIdx, 1);
    }
    this.parentMap.delete(childIdx);
  }

  getParent(id: EntityId): EntityId | null {
    if (!this.isAlive(id)) return null;
    return this.parentMap.get(entityIndex(id)) ?? null;
  }

  getChildren(id: EntityId): EntityId[] {
    if (!this.isAlive(id)) return [];
    const children = this.childrenMap.get(entityIndex(id));
    return children ? [...children] : [];
  }

  // ═══════════════════════════════════════════════════════
  //  Component API
  // ═══════════════════════════════════════════════════════

  private getOrCreateStore<T>(type: ComponentClass<T>): SparseSet<T> {
    const id = getComponentId(type);
    let store = this.stores.get(id) as SparseSet<T> | undefined;
    if (!store) {
      store = new SparseSet<T>();
      this.stores.set(id, store as SparseSet<unknown>);
      this.storeTypeMap.set(store as SparseSet<unknown>, type);
    }
    return store;
  }

  /** Add a component to an entity. Returns the component instance. */
  addComponent<T extends object>(
    id: EntityId,
    type: ComponentClass<T>,
    data?: Partial<T>,
  ): T {
    if (this.insideSystemExecution) {
      this.deferredOps.push({
        kind: "addComponent",
        entityId: id,
        componentType: type,
        componentData: data as Record<string, unknown>,
      });
      const temp = new type();
      if (data) Object.assign(temp, data);
      return temp;
    }
    return this.addComponentImmediate(id, type, data);
  }

  private addComponentImmediate<T extends object>(
    id: EntityId,
    type: ComponentClass<T>,
    data?: Partial<T>,
  ): T {
    this.assertAlive(id);
    const store = this.getOrCreateStore(type);
    const idx = entityIndex(id);
    const instance = new type();
    if (data) Object.assign(instance, data);
    store.set(idx, instance);
    this.structuralVersion++;

    const compId = getComponentId(type);
    const hooks = this.onAddedHooks.get(compId);
    if (hooks) {
      for (const hook of hooks) hook(id);
    }

    if (this.dirtyTracker) {
      this.dirtyTracker.markDirty(id, type);
    }

    return instance;
  }

  /** Get a component from an entity, or null if absent. */
  getComponent<T>(id: EntityId, type: ComponentClass<T>): T | null {
    if (!this.isAlive(id)) return null;
    const store = this.getOrCreateStore(type);
    return store.get(entityIndex(id)) ?? null;
  }

  /** Check if an entity has a component. */
  hasComponent<T>(id: EntityId, type: ComponentClass<T>): boolean {
    if (!this.isAlive(id)) return false;
    const store = this.getOrCreateStore(type);
    return store.has(entityIndex(id));
  }

  /** Remove a component from an entity. */
  removeComponent<T>(id: EntityId, type: ComponentClass<T>): void {
    if (this.insideSystemExecution) {
      this.deferredOps.push({
        kind: "removeComponent",
        entityId: id,
        componentType: type,
      });
      return;
    }
    this.removeComponentImmediate(id, type);
  }

  private removeComponentImmediate<T>(
    id: EntityId,
    type: ComponentClass<T>,
  ): void {
    this.assertAlive(id);
    const compId = getComponentId(type);
    const store = this.stores.get(compId) as SparseSet<T> | undefined;
    if (!store) return;

    const idx = entityIndex(id);
    if (store.has(idx)) {
      const hooks = this.onRemovedHooks.get(compId);
      if (hooks) {
        for (const hook of hooks) hook(id);
      }

      if (this.dirtyTracker) {
        this.dirtyTracker.markDirty(id, type);
      }

      store.remove(idx);
      this.structuralVersion++;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Singleton API
  // ═══════════════════════════════════════════════════════

  setSingleton<T extends object>(
    type: ComponentClass<T>,
    data?: Partial<T>,
  ): T {
    const id = getComponentId(type);
    const instance = new type();
    if (data) Object.assign(instance, data);
    this.singletons.set(id, instance);
    this.singletonTypes.set(id, type);
    return instance;
  }

  getSingleton<T>(type: ComponentClass<T>): T | null {
    const id = getComponentId(type);
    return (this.singletons.get(id) as T) ?? null;
  }

  removeSingleton<T>(type: ComponentClass<T>): void {
    const id = getComponentId(type);
    this.singletons.delete(id);
  }

  // ═══════════════════════════════════════════════════════
  //  Query API
  // ═══════════════════════════════════════════════════════

  /** Start building a query. */
  query(...types: ComponentClass[]): QueryBuilder {
    return new QueryBuilder(this, types);
  }

  /**
   * Execute a query. Results are cached; cache invalidated on structural changes.
   * Called internally by QueryBuilder.
   */
  executeQuery(
    required: ComponentClass[],
    excluded: ComponentClass[],
  ): EntityId[] {
    const key = this.makeQueryKey(required, excluded);
    const cached = this.queryCache.get(key);

    if (cached && cached.version === this.structuralVersion) {
      return cached.result;
    }

    // Find the smallest required store for iteration.
    let smallestStore: SparseSet<unknown> | null = null;
    let smallestSize = Infinity;

    for (const type of required) {
      const store = this.stores.get(getComponentId(type));
      if (!store || store.size === 0) {
        const result: EntityId[] = [];
        this.queryCache.set(key, {
          key,
          required,
          excluded,
          result,
          version: this.structuralVersion,
        });
        return result;
      }
      if (store.size < smallestSize) {
        smallestSize = store.size;
        smallestStore = store;
      }
    }

    if (!smallestStore) {
      const result: EntityId[] = [];
      this.queryCache.set(key, {
        key,
        required,
        excluded,
        result,
        version: this.structuralVersion,
      });
      return result;
    }

    const result: EntityId[] = [];
    const storeKeys = smallestStore.keys();

    for (let i = 0; i < storeKeys.length; i++) {
      const entityIdx = storeKeys[i];

      // Check all required components.
      let matches = true;
      for (const type of required) {
        const store = this.stores.get(getComponentId(type));
        if (!store || !store.has(entityIdx)) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;

      // Check exclusions.
      let isExcluded = false;
      for (const type of excluded) {
        const store = this.stores.get(getComponentId(type));
        if (store && store.has(entityIdx)) {
          isExcluded = true;
          break;
        }
      }
      if (isExcluded) continue;

      // Reconstruct full EntityId from index.
      const fullId = this.indexToEntity.get(entityIdx);
      if (fullId !== undefined) {
        result.push(fullId);
      }
    }

    this.queryCache.set(key, {
      key,
      required,
      excluded,
      result,
      version: this.structuralVersion,
    });

    return result;
  }

  /** Build a canonical cache key for a query. */
  private makeQueryKey(
    required: ComponentClass[],
    excluded: ComponentClass[],
  ): string {
    const reqIds = required.map(getComponentId).sort((a, b) => a - b);
    const exclIds = excluded.map(getComponentId).sort((a, b) => a - b);
    return `r:${reqIds.join(",")};e:${exclIds.join(",")}`;
  }

  /**
   * Ergonomic callback iteration (EnTT view.each pattern).
   */
  each<A>(a: ComponentClass<A>, cb: (eid: EntityId, a: A) => void): void;
  each<A, B>(
    a: ComponentClass<A>,
    b: ComponentClass<B>,
    cb: (eid: EntityId, a: A, b: B) => void,
  ): void;
  each<A, B, C>(
    a: ComponentClass<A>,
    b: ComponentClass<B>,
    c: ComponentClass<C>,
    cb: (eid: EntityId, a: A, b: B, c: C) => void,
  ): void;
  each<A, B, C, D>(
    a: ComponentClass<A>,
    b: ComponentClass<B>,
    c: ComponentClass<C>,
    d: ComponentClass<D>,
    cb: (eid: EntityId, a: A, b: B, c: C, d: D) => void,
  ): void;
  each(...args: unknown[]): void {
    const cb = args[args.length - 1] as Function;
    const types = args.slice(0, -1) as ComponentClass[];
    const entities = this.executeQuery(types, []);

    for (const eid of entities) {
      const idx = entityIndex(eid);
      const components = types.map((type) => {
        const store = this.stores.get(getComponentId(type));
        return store!.get(idx);
      });
      cb(eid, ...components);
    }
  }

  /**
   * Typed iterable query — returns [EntityId, ...components] tuples.
   */
  queryWith<A>(a: ComponentClass<A>): Iterable<[EntityId, A]>;
  queryWith<A, B>(
    a: ComponentClass<A>,
    b: ComponentClass<B>,
  ): Iterable<[EntityId, A, B]>;
  queryWith<A, B, C>(
    a: ComponentClass<A>,
    b: ComponentClass<B>,
    c: ComponentClass<C>,
  ): Iterable<[EntityId, A, B, C]>;
  queryWith(...types: ComponentClass[]): Iterable<unknown[]> {
    const world = this;
    return {
      *[Symbol.iterator]() {
        const entities = world.executeQuery(types, []);
        for (const eid of entities) {
          const idx = entityIndex(eid);
          const tuple: unknown[] = [eid];
          for (const type of types) {
            const store = world.stores.get(getComponentId(type));
            tuple.push(store!.get(idx));
          }
          yield tuple;
        }
      },
    };
  }

  // ═══════════════════════════════════════════════════════
  //  System API
  // ═══════════════════════════════════════════════════════

  addSystem(name: string, fn: SystemFn, priority: number = 0): void {
    this.systems.push({ name, fn, priority });
    this.systemsSorted = false;
  }

  removeSystem(name: string): void {
    const idx = this.systems.findIndex((s) => s.name === name);
    if (idx !== -1) {
      this.systems.splice(idx, 1);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Lifecycle Hooks
  // ═══════════════════════════════════════════════════════

  onComponentAdded<T>(type: ComponentClass<T>, cb: ComponentCallback): void {
    const id = getComponentId(type);
    let hooks = this.onAddedHooks.get(id);
    if (!hooks) {
      hooks = [];
      this.onAddedHooks.set(id, hooks);
    }
    hooks.push(cb);
  }

  onComponentRemoved<T>(type: ComponentClass<T>, cb: ComponentCallback): void {
    const id = getComponentId(type);
    let hooks = this.onRemovedHooks.get(id);
    if (!hooks) {
      hooks = [];
      this.onRemovedHooks.set(id, hooks);
    }
    hooks.push(cb);
  }

  // ═══════════════════════════════════════════════════════
  //  Command Queue API
  // ═══════════════════════════════════════════════════════

  enqueueCommand(command: Command): void {
    this.commandQueue.enqueue(command);
  }

  getCommands(type: string): Command[] {
    return this.commandQueue.getByType(type);
  }

  clearCommands(): void {
    this.commandQueue.clear();
  }

  // ═══════════════════════════════════════════════════════
  //  Tick Loop
  // ═══════════════════════════════════════════════════════

  tick(dt: number): void {
    this.time += dt;
    this.tickCount++;
    this.tickErrors = [];

    if (!this.systemsSorted) {
      this.systems.sort((a, b) => a.priority - b.priority);
      this.systemsSorted = true;
    }

    this.insideSystemExecution = true;

    for (const system of this.systems) {
      try {
        system.fn(this, dt);
      } catch (error) {
        this.tickErrors.push({
          systemName: system.name,
          tickCount: this.tickCount,
          error,
        });
      }

      // Flush deferred ops between each system.
      this.insideSystemExecution = false;
      this.flushDeferred();
      this.insideSystemExecution = true;
    }

    this.insideSystemExecution = false;
    this.flushDeferred();
    this.commandQueue.clear();
  }

  getTickErrors(): SystemError[] {
    return this.tickErrors;
  }

  // ═══════════════════════════════════════════════════════
  //  Deferred Operations
  // ═══════════════════════════════════════════════════════

  flushDeferred(): void {
    const wasInside = this.insideSystemExecution;
    this.insideSystemExecution = false;

    while (this.deferredOps.length > 0) {
      const ops = [...this.deferredOps];
      this.deferredOps.length = 0;

      for (const op of ops) {
        switch (op.kind) {
          case "destroyEntity":
            if (op.entityId !== undefined) {
              this.destroyEntityImmediate(op.entityId);
            }
            break;
          case "addComponent":
            if (op.entityId !== undefined && op.componentType !== undefined) {
              this.addComponentImmediate(
                op.entityId,
                op.componentType,
                op.componentData,
              );
            }
            break;
          case "removeComponent":
            if (op.entityId !== undefined && op.componentType !== undefined) {
              this.removeComponentImmediate(op.entityId, op.componentType);
            }
            break;
        }
      }
    }

    this.insideSystemExecution = wasInside;
  }

  // ═══════════════════════════════════════════════════════
  //  Dirty Tracking API
  // ═══════════════════════════════════════════════════════

  /** Enable dirty tracking for networking. Off by default for performance. */
  enableDirtyTracking(): void {
    if (!this.dirtyTracker) {
      this.dirtyTracker = new DirtyTracker();
    }
    this.dirtyTrackingEnabled = true;
  }

  /** Disable dirty tracking. */
  disableDirtyTracking(): void {
    this.dirtyTrackingEnabled = false;
    this.dirtyTracker = null;
  }

  /** Manually mark a component as dirty (for manual dirty tracking mode). */
  markDirty(entityId: EntityId, componentType: ComponentClass): void {
    if (this.dirtyTracker) {
      this.dirtyTracker.markDirty(entityId, componentType);
    }
  }

  /** Get the dirty tracker (null if tracking is disabled). */
  getDirtyTracker(): DirtyTracker | null {
    return this.dirtyTracker;
  }

  // ═══════════════════════════════════════════════════════
  //  Networking Convenience API
  // ═══════════════════════════════════════════════════════

  /** Encode current dirty state into a WorldDelta, then flush the tracker. */
  getDelta(): WorldDelta {
    const delta = this.deltaEncoder.encode(this);
    if (this.dirtyTracker) {
      this.dirtyTracker.flush();
    }
    return delta;
  }

  /** Apply a WorldDelta to this world (client-side). */
  applyDelta(delta: WorldDelta): void {
    this.deltaEncoder.decode(this, delta);
  }

  /** Capture a full snapshot of this world. */
  captureSnapshot(): WorldSnapshot {
    return captureSnapshotFn(this);
  }

  /** Apply a snapshot to this world (CLEARS the world first). */
  applySnapshot(snapshot: WorldSnapshot): void {
    applySnapshotFn(this, snapshot);
  }

  // ═══════════════════════════════════════════════════════
  //  Serialisation Support API
  // ═══════════════════════════════════════════════════════

  /**
   * Create an entity with a specific ID (for delta decode / snapshot restore).
   * The entity pool will be expanded to accommodate the index if needed.
   */
  createEntityWithId(id: EntityId): EntityId {
    this.entityPool.createWithId(id);
    const idx = entityIndex(id);
    this.indexToEntity.set(idx, id);
    this.structuralVersion++;
    return id;
  }

  /** Get all alive entity IDs. */
  getAllEntities(): EntityId[] {
    return [...this.indexToEntity.values()].filter((id) =>
      this.entityPool.isAlive(id),
    );
  }

  /** Get all component types that have at least one instance stored. */
  getRegisteredComponentTypes(): ComponentClass[] {
    const types: ComponentClass[] = [];
    // We need a reverse map from component ID to class.
    // Since stores are keyed by component ID, we track types when stores are created.
    for (const [, store] of this.stores) {
      if (store.size > 0) {
        // Get the ComponentClass from our tracking map
        const compClass = this.storeTypeMap.get(store);
        if (compClass) types.push(compClass);
      }
    }
    return types;
  }

  /** Get all singletons as [ComponentClass, data] pairs. */
  getAllSingletons(): Array<[ComponentClass, unknown]> {
    const result: Array<[ComponentClass, unknown]> = [];
    for (const [id, data] of this.singletons) {
      const type = this.singletonTypes.get(id);
      if (type) {
        result.push([type, data]);
      }
    }
    return result;
  }

  /** Clear all entities, components, singletons, and reset time. */
  clear(): void {
    // Destroy all entities (iterate a snapshot to avoid mutation issues)
    const allEntities = this.getAllEntities();
    for (const id of allEntities) {
      // Only destroy roots; cascade handles children
      if (this.getParent(id) === null) {
        this.destroyEntityImmediate(id);
      }
    }

    // Clear any remaining state
    for (const store of this.stores.values()) {
      store.clear();
    }
    this.parentMap.clear();
    this.childrenMap.clear();
    this.indexToEntity.clear();
    this.singletons.clear();
    this.singletonTypes.clear();
    this.queryCache.clear();
    this.structuralVersion++;
    this.entityPool.reset();
  }
}
