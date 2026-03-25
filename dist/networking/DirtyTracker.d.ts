/**
 * DirtyTracker — tracks which components on which entities have changed since last flush.
 *
 * Used by the delta encoder to produce minimal network updates.
 * Opt-in via world.enableDirtyTracking().
 */
import type { EntityId } from "../core/Entity.js";
import type { ComponentClass } from "../core/Component.js";
export interface DirtyEntry {
    entityId: EntityId;
    componentType: ComponentClass;
}
export declare class DirtyTracker {
    /** Set of "entityId:componentId" strings for deduplication. */
    private readonly dirtySet;
    private readonly dirtyEntries;
    private readonly createdEntities;
    private readonly destroyedEntities;
    /** Mark a specific component on an entity as dirty. */
    markDirty(entityId: EntityId, componentType: ComponentClass): void;
    /** Get all dirty entries since last flush. */
    getDirtyEntries(): DirtyEntry[];
    /** Clear all dirty flags (called after serialisation). */
    flush(): void;
    /** Track entity creation (full snapshot needed for this entity). */
    markCreated(entityId: EntityId): void;
    /** Track entity destruction. */
    markDestroyed(entityId: EntityId): void;
    /** Get entities created since last flush. */
    getCreatedEntities(): EntityId[];
    /** Get entities destroyed since last flush. */
    getDestroyedEntities(): EntityId[];
}
//# sourceMappingURL=DirtyTracker.d.ts.map