/**
 * World — the central registry of entities, component stores, queries, and systems.
 *
 * Session-scoped: each VGF session gets its own World instance.
 * No global mutable state — multiple Worlds in the same process are fully isolated.
 */
import { type EntityId } from "./Entity.js";
import { type ComponentClass } from "./Component.js";
import { QueryBuilder } from "./Query.js";
import type { SystemFn, SystemError } from "./System.js";
import { type Command } from "./CommandQueue.js";
import { DirtyTracker } from "../networking/DirtyTracker.js";
import { type WorldDelta } from "../networking/DeltaEncoder.js";
import { type WorldSnapshot } from "../networking/Snapshot.js";
/** Callback type for component lifecycle hooks. */
type ComponentCallback = (eid: EntityId) => void;
export declare class World {
    readonly sessionId: string;
    time: number;
    tickCount: number;
    private readonly entityPool;
    private readonly parentMap;
    private readonly childrenMap;
    /** Maps entity index → full EntityId (with generation), for query results. */
    private readonly indexToEntity;
    private readonly stores;
    /** Reverse map: SparseSet → ComponentClass (for serialisation). */
    private readonly storeTypeMap;
    private readonly singletons;
    private structuralVersion;
    private readonly queryCache;
    private readonly systems;
    private systemsSorted;
    private readonly deferredOps;
    private insideSystemExecution;
    private tickErrors;
    private readonly commandQueue;
    private readonly onAddedHooks;
    private readonly onRemovedHooks;
    private dirtyTracker;
    private dirtyTrackingEnabled;
    private readonly deltaEncoder;
    private readonly singletonTypes;
    constructor(options?: {
        sessionId?: string;
    });
    /**
     * Assert that an entity ID refers to a currently alive entity.
     * Throws if the entity is dead or stale (recycled generation).
     */
    private assertAlive;
    /** Create an entity, optionally as a child of a parent. */
    createEntity(parent?: EntityId): EntityId;
    private createEntityImmediate;
    /** Destroy an entity and cascade to all children (depth-first). */
    destroyEntity(id: EntityId): void;
    private destroyEntityImmediate;
    /** Check if an entity is alive. */
    isAlive(id: EntityId): boolean;
    /** Number of alive entities. */
    get entityCount(): number;
    setParent(childId: EntityId, parentId: EntityId): void;
    private setParentImmediate;
    removeParent(childId: EntityId): void;
    getParent(id: EntityId): EntityId | null;
    getChildren(id: EntityId): EntityId[];
    private getOrCreateStore;
    /** Add a component to an entity. Returns the component instance. */
    addComponent<T extends object>(id: EntityId, type: ComponentClass<T>, data?: Partial<T>): T;
    private addComponentImmediate;
    /** Get a component from an entity, or null if absent. */
    getComponent<T>(id: EntityId, type: ComponentClass<T>): T | null;
    /** Check if an entity has a component. */
    hasComponent<T>(id: EntityId, type: ComponentClass<T>): boolean;
    /** Remove a component from an entity. */
    removeComponent<T>(id: EntityId, type: ComponentClass<T>): void;
    private removeComponentImmediate;
    setSingleton<T extends object>(type: ComponentClass<T>, data?: Partial<T>): T;
    getSingleton<T>(type: ComponentClass<T>): T | null;
    removeSingleton<T>(type: ComponentClass<T>): void;
    /** Start building a query. */
    query(...types: ComponentClass[]): QueryBuilder;
    /**
     * Execute a query. Results are cached; cache invalidated on structural changes.
     * Called internally by QueryBuilder.
     */
    executeQuery(required: ComponentClass[], excluded: ComponentClass[]): EntityId[];
    /** Build a canonical cache key for a query. */
    private makeQueryKey;
    /**
     * Ergonomic callback iteration (EnTT view.each pattern).
     */
    each<A>(a: ComponentClass<A>, cb: (eid: EntityId, a: A) => void): void;
    each<A, B>(a: ComponentClass<A>, b: ComponentClass<B>, cb: (eid: EntityId, a: A, b: B) => void): void;
    each<A, B, C>(a: ComponentClass<A>, b: ComponentClass<B>, c: ComponentClass<C>, cb: (eid: EntityId, a: A, b: B, c: C) => void): void;
    each<A, B, C, D>(a: ComponentClass<A>, b: ComponentClass<B>, c: ComponentClass<C>, d: ComponentClass<D>, cb: (eid: EntityId, a: A, b: B, c: C, d: D) => void): void;
    /**
     * Typed iterable query — returns [EntityId, ...components] tuples.
     */
    queryWith<A>(a: ComponentClass<A>): Iterable<[EntityId, A]>;
    queryWith<A, B>(a: ComponentClass<A>, b: ComponentClass<B>): Iterable<[EntityId, A, B]>;
    queryWith<A, B, C>(a: ComponentClass<A>, b: ComponentClass<B>, c: ComponentClass<C>): Iterable<[EntityId, A, B, C]>;
    addSystem(name: string, fn: SystemFn, priority?: number): void;
    removeSystem(name: string): void;
    onComponentAdded<T>(type: ComponentClass<T>, cb: ComponentCallback): void;
    onComponentRemoved<T>(type: ComponentClass<T>, cb: ComponentCallback): void;
    enqueueCommand(command: Command): void;
    getCommands(type: string): Command[];
    clearCommands(): void;
    tick(dt: number): void;
    getTickErrors(): SystemError[];
    flushDeferred(): void;
    /** Enable dirty tracking for networking. Off by default for performance. */
    enableDirtyTracking(): void;
    /** Disable dirty tracking. */
    disableDirtyTracking(): void;
    /** Manually mark a component as dirty (for manual dirty tracking mode). */
    markDirty(entityId: EntityId, componentType: ComponentClass): void;
    /** Get the dirty tracker (null if tracking is disabled). */
    getDirtyTracker(): DirtyTracker | null;
    /** Encode current dirty state into a WorldDelta, then flush the tracker. */
    getDelta(): WorldDelta;
    /** Apply a WorldDelta to this world (client-side). */
    applyDelta(delta: WorldDelta): void;
    /** Capture a full snapshot of this world. */
    captureSnapshot(): WorldSnapshot;
    /** Apply a snapshot to this world (CLEARS the world first). */
    applySnapshot(snapshot: WorldSnapshot): void;
    /**
     * Create an entity with a specific ID (for delta decode / snapshot restore).
     * The entity pool will be expanded to accommodate the index if needed.
     */
    createEntityWithId(id: EntityId): EntityId;
    /** Get all alive entity IDs. */
    getAllEntities(): EntityId[];
    /** Get all component types that have at least one instance stored. */
    getRegisteredComponentTypes(): ComponentClass[];
    /** Get all singletons as [ComponentClass, data] pairs. */
    getAllSingletons(): Array<[ComponentClass, unknown]>;
    /** Clear all entities, components, singletons, and reset time. */
    clear(): void;
}
export {};
//# sourceMappingURL=World.d.ts.map