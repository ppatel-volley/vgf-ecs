/**
 * World — the central registry of entities, component stores, queries, and systems.
 *
 * Session-scoped: each VGF session gets its own World instance.
 * No global mutable state — multiple Worlds in the same process are fully isolated.
 */
import { EntityPool, entityIndex, NULL_ENTITY, } from "./Entity.js";
import { getComponentId } from "./Component.js";
import { SparseSet } from "./SparseSet.js";
import { QueryBuilder } from "./Query.js";
import { CommandQueue } from "./CommandQueue.js";
import { DirtyTracker } from "../networking/DirtyTracker.js";
import { DeltaEncoder } from "../networking/DeltaEncoder.js";
import { captureSnapshot as captureSnapshotFn, applySnapshot as applySnapshotFn, } from "../networking/Snapshot.js";
export class World {
    // ── Identity ──
    sessionId;
    // ── Time ──
    time = 0;
    tickCount = 0;
    // ── Entity management ──
    entityPool = new EntityPool();
    parentMap = new Map();
    childrenMap = new Map();
    /** Maps entity index → full EntityId (with generation), for query results. */
    indexToEntity = new Map();
    // ── Component storage ──
    stores = new Map();
    /** Reverse map: SparseSet → ComponentClass (for serialisation). */
    storeTypeMap = new Map();
    // ── Singleton storage ──
    singletons = new Map();
    // ── Query cache ──
    structuralVersion = 0;
    queryCache = new Map();
    // ── Systems ──
    systems = [];
    systemsSorted = false;
    // ── Deferred operations ──
    deferredOps = [];
    insideSystemExecution = false;
    // ── Tick errors ──
    tickErrors = [];
    // ── Command queue ──
    commandQueue = new CommandQueue();
    // ── Lifecycle hooks ──
    onAddedHooks = new Map();
    onRemovedHooks = new Map();
    // ── Dirty tracking (opt-in) ──
    dirtyTracker = null;
    dirtyTrackingEnabled = false;
    deltaEncoder = new DeltaEncoder();
    // ── Singleton type tracking (for serialisation) ──
    singletonTypes = new Map();
    constructor(options) {
        this.sessionId = options?.sessionId ?? "";
    }
    /**
     * Assert that an entity ID refers to a currently alive entity.
     * Throws if the entity is dead or stale (recycled generation).
     */
    assertAlive(id) {
        if (!this.entityPool.isAlive(id)) {
            throw new Error(`Entity ${id} is not alive (stale or destroyed reference)`);
        }
    }
    // ═══════════════════════════════════════════════════════
    //  Entity API
    // ═══════════════════════════════════════════════════════
    /** Create an entity, optionally as a child of a parent. */
    createEntity(parent) {
        // Entity creation is always immediate — safe during system execution.
        // New entities won't appear in existing cached queries until structural
        // version increments and queries are re-evaluated.
        return this.createEntityImmediate(parent);
    }
    createEntityImmediate(parent) {
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
    destroyEntity(id) {
        if (this.insideSystemExecution) {
            this.deferredOps.push({ kind: "destroyEntity", entityId: id });
            return;
        }
        this.destroyEntityImmediate(id);
    }
    destroyEntityImmediate(id) {
        if (!this.entityPool.isAlive(id))
            return;
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
                if (sibIdx !== -1)
                    siblings.splice(sibIdx, 1);
            }
            this.parentMap.delete(idx);
        }
        // Remove all components.
        for (const [compId, store] of this.stores) {
            if (store.has(idx)) {
                const hooks = this.onRemovedHooks.get(compId);
                if (hooks) {
                    for (const hook of hooks)
                        hook(id);
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
    isAlive(id) {
        return this.entityPool.isAlive(id);
    }
    /** Number of alive entities. */
    get entityCount() {
        return this.entityPool.count;
    }
    // ═══════════════════════════════════════════════════════
    //  Hierarchy API
    // ═══════════════════════════════════════════════════════
    setParent(childId, parentId) {
        this.assertAlive(childId);
        this.assertAlive(parentId);
        this.setParentImmediate(childId, parentId);
    }
    setParentImmediate(childId, parentId) {
        // Prevent self-parenting.
        if (childId === parentId) {
            throw new Error("Cannot parent entity to itself");
        }
        // Prevent ancestor cycles: walk up from parentId, if we reach childId it's a cycle.
        let cursor = parentId;
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
                if (sibIdx !== -1)
                    siblings.splice(sibIdx, 1);
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
    removeParent(childId) {
        this.assertAlive(childId);
        const childIdx = entityIndex(childId);
        const parentId = this.parentMap.get(childIdx);
        if (parentId === undefined)
            return;
        const parentIdx = entityIndex(parentId);
        const siblings = this.childrenMap.get(parentIdx);
        if (siblings) {
            const sibIdx = siblings.indexOf(childId);
            if (sibIdx !== -1)
                siblings.splice(sibIdx, 1);
        }
        this.parentMap.delete(childIdx);
    }
    getParent(id) {
        if (!this.isAlive(id))
            return null;
        return this.parentMap.get(entityIndex(id)) ?? null;
    }
    getChildren(id) {
        if (!this.isAlive(id))
            return [];
        const children = this.childrenMap.get(entityIndex(id));
        return children ? [...children] : [];
    }
    // ═══════════════════════════════════════════════════════
    //  Component API
    // ═══════════════════════════════════════════════════════
    getOrCreateStore(type) {
        const id = getComponentId(type);
        let store = this.stores.get(id);
        if (!store) {
            store = new SparseSet();
            this.stores.set(id, store);
            this.storeTypeMap.set(store, type);
        }
        return store;
    }
    /** Add a component to an entity. Returns the component instance. */
    addComponent(id, type, data) {
        if (this.insideSystemExecution) {
            this.deferredOps.push({
                kind: "addComponent",
                entityId: id,
                componentType: type,
                componentData: data,
            });
            const temp = new type();
            if (data)
                Object.assign(temp, data);
            return temp;
        }
        return this.addComponentImmediate(id, type, data);
    }
    addComponentImmediate(id, type, data) {
        this.assertAlive(id);
        const store = this.getOrCreateStore(type);
        const idx = entityIndex(id);
        const instance = new type();
        if (data)
            Object.assign(instance, data);
        store.set(idx, instance);
        this.structuralVersion++;
        const compId = getComponentId(type);
        const hooks = this.onAddedHooks.get(compId);
        if (hooks) {
            for (const hook of hooks)
                hook(id);
        }
        if (this.dirtyTracker) {
            this.dirtyTracker.markDirty(id, type);
        }
        return instance;
    }
    /** Get a component from an entity, or null if absent. */
    getComponent(id, type) {
        if (!this.isAlive(id))
            return null;
        const store = this.getOrCreateStore(type);
        return store.get(entityIndex(id)) ?? null;
    }
    /** Check if an entity has a component. */
    hasComponent(id, type) {
        if (!this.isAlive(id))
            return false;
        const store = this.getOrCreateStore(type);
        return store.has(entityIndex(id));
    }
    /** Remove a component from an entity. */
    removeComponent(id, type) {
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
    removeComponentImmediate(id, type) {
        this.assertAlive(id);
        const compId = getComponentId(type);
        const store = this.stores.get(compId);
        if (!store)
            return;
        const idx = entityIndex(id);
        if (store.has(idx)) {
            const hooks = this.onRemovedHooks.get(compId);
            if (hooks) {
                for (const hook of hooks)
                    hook(id);
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
    setSingleton(type, data) {
        const id = getComponentId(type);
        const instance = new type();
        if (data)
            Object.assign(instance, data);
        this.singletons.set(id, instance);
        this.singletonTypes.set(id, type);
        return instance;
    }
    getSingleton(type) {
        const id = getComponentId(type);
        return this.singletons.get(id) ?? null;
    }
    removeSingleton(type) {
        const id = getComponentId(type);
        this.singletons.delete(id);
    }
    // ═══════════════════════════════════════════════════════
    //  Query API
    // ═══════════════════════════════════════════════════════
    /** Start building a query. */
    query(...types) {
        return new QueryBuilder(this, types);
    }
    /**
     * Execute a query. Results are cached; cache invalidated on structural changes.
     * Called internally by QueryBuilder.
     */
    executeQuery(required, excluded) {
        const key = this.makeQueryKey(required, excluded);
        const cached = this.queryCache.get(key);
        if (cached && cached.version === this.structuralVersion) {
            return cached.result;
        }
        // Find the smallest required store for iteration.
        let smallestStore = null;
        let smallestSize = Infinity;
        for (const type of required) {
            const store = this.stores.get(getComponentId(type));
            if (!store || store.size === 0) {
                const result = [];
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
            const result = [];
            this.queryCache.set(key, {
                key,
                required,
                excluded,
                result,
                version: this.structuralVersion,
            });
            return result;
        }
        const result = [];
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
            if (!matches)
                continue;
            // Check exclusions.
            let isExcluded = false;
            for (const type of excluded) {
                const store = this.stores.get(getComponentId(type));
                if (store && store.has(entityIdx)) {
                    isExcluded = true;
                    break;
                }
            }
            if (isExcluded)
                continue;
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
    makeQueryKey(required, excluded) {
        const reqIds = required.map(getComponentId).sort((a, b) => a - b);
        const exclIds = excluded.map(getComponentId).sort((a, b) => a - b);
        return `r:${reqIds.join(",")};e:${exclIds.join(",")}`;
    }
    each(...args) {
        const cb = args[args.length - 1];
        const types = args.slice(0, -1);
        const entities = this.executeQuery(types, []);
        for (const eid of entities) {
            const idx = entityIndex(eid);
            const components = types.map((type) => {
                const store = this.stores.get(getComponentId(type));
                return store.get(idx);
            });
            cb(eid, ...components);
        }
    }
    queryWith(...types) {
        const world = this;
        return {
            *[Symbol.iterator]() {
                const entities = world.executeQuery(types, []);
                for (const eid of entities) {
                    const idx = entityIndex(eid);
                    const tuple = [eid];
                    for (const type of types) {
                        const store = world.stores.get(getComponentId(type));
                        tuple.push(store.get(idx));
                    }
                    yield tuple;
                }
            },
        };
    }
    // ═══════════════════════════════════════════════════════
    //  System API
    // ═══════════════════════════════════════════════════════
    addSystem(name, fn, priority = 0) {
        this.systems.push({ name, fn, priority });
        this.systemsSorted = false;
    }
    removeSystem(name) {
        const idx = this.systems.findIndex((s) => s.name === name);
        if (idx !== -1) {
            this.systems.splice(idx, 1);
        }
    }
    // ═══════════════════════════════════════════════════════
    //  Lifecycle Hooks
    // ═══════════════════════════════════════════════════════
    onComponentAdded(type, cb) {
        const id = getComponentId(type);
        let hooks = this.onAddedHooks.get(id);
        if (!hooks) {
            hooks = [];
            this.onAddedHooks.set(id, hooks);
        }
        hooks.push(cb);
    }
    onComponentRemoved(type, cb) {
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
    enqueueCommand(command) {
        this.commandQueue.enqueue(command);
    }
    getCommands(type) {
        return this.commandQueue.getByType(type);
    }
    clearCommands() {
        this.commandQueue.clear();
    }
    // ═══════════════════════════════════════════════════════
    //  Tick Loop
    // ═══════════════════════════════════════════════════════
    tick(dt) {
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
            }
            catch (error) {
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
    getTickErrors() {
        return this.tickErrors;
    }
    // ═══════════════════════════════════════════════════════
    //  Deferred Operations
    // ═══════════════════════════════════════════════════════
    flushDeferred() {
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
                            this.addComponentImmediate(op.entityId, op.componentType, op.componentData);
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
    enableDirtyTracking() {
        if (!this.dirtyTracker) {
            this.dirtyTracker = new DirtyTracker();
        }
        this.dirtyTrackingEnabled = true;
    }
    /** Disable dirty tracking. */
    disableDirtyTracking() {
        this.dirtyTrackingEnabled = false;
        this.dirtyTracker = null;
    }
    /** Manually mark a component as dirty (for manual dirty tracking mode). */
    markDirty(entityId, componentType) {
        if (this.dirtyTracker) {
            this.dirtyTracker.markDirty(entityId, componentType);
        }
    }
    /** Get the dirty tracker (null if tracking is disabled). */
    getDirtyTracker() {
        return this.dirtyTracker;
    }
    // ═══════════════════════════════════════════════════════
    //  Networking Convenience API
    // ═══════════════════════════════════════════════════════
    /** Encode current dirty state into a WorldDelta, then flush the tracker. */
    getDelta() {
        const delta = this.deltaEncoder.encode(this);
        if (this.dirtyTracker) {
            this.dirtyTracker.flush();
        }
        return delta;
    }
    /** Apply a WorldDelta to this world (client-side). */
    applyDelta(delta) {
        this.deltaEncoder.decode(this, delta);
    }
    /** Capture a full snapshot of this world. */
    captureSnapshot() {
        return captureSnapshotFn(this);
    }
    /** Apply a snapshot to this world (CLEARS the world first). */
    applySnapshot(snapshot) {
        applySnapshotFn(this, snapshot);
    }
    // ═══════════════════════════════════════════════════════
    //  Serialisation Support API
    // ═══════════════════════════════════════════════════════
    /**
     * Create an entity with a specific ID (for delta decode / snapshot restore).
     * The entity pool will be expanded to accommodate the index if needed.
     */
    createEntityWithId(id) {
        this.entityPool.createWithId(id);
        const idx = entityIndex(id);
        this.indexToEntity.set(idx, id);
        this.structuralVersion++;
        return id;
    }
    /** Get all alive entity IDs. */
    getAllEntities() {
        return [...this.indexToEntity.values()].filter((id) => this.entityPool.isAlive(id));
    }
    /** Get all component types that have at least one instance stored. */
    getRegisteredComponentTypes() {
        const types = [];
        // We need a reverse map from component ID to class.
        // Since stores are keyed by component ID, we track types when stores are created.
        for (const [, store] of this.stores) {
            if (store.size > 0) {
                // Get the ComponentClass from our tracking map
                const compClass = this.storeTypeMap.get(store);
                if (compClass)
                    types.push(compClass);
            }
        }
        return types;
    }
    /** Get all singletons as [ComponentClass, data] pairs. */
    getAllSingletons() {
        const result = [];
        for (const [id, data] of this.singletons) {
            const type = this.singletonTypes.get(id);
            if (type) {
                result.push([type, data]);
            }
        }
        return result;
    }
    /** Clear all entities, components, singletons, and reset time. */
    clear() {
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
//# sourceMappingURL=World.js.map