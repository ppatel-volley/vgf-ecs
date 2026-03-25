import { getComponentId } from "../core/Component.js";
export class DirtyTracker {
    /** Set of "entityId:componentId" strings for deduplication. */
    dirtySet = new Set();
    dirtyEntries = [];
    createdEntities = [];
    destroyedEntities = [];
    /** Mark a specific component on an entity as dirty. */
    markDirty(entityId, componentType) {
        const key = `${entityId}:${getComponentId(componentType)}`;
        if (this.dirtySet.has(key))
            return; // coalesce duplicates
        this.dirtySet.add(key);
        this.dirtyEntries.push({ entityId, componentType });
    }
    /** Get all dirty entries since last flush. */
    getDirtyEntries() {
        return [...this.dirtyEntries];
    }
    /** Clear all dirty flags (called after serialisation). */
    flush() {
        this.dirtySet.clear();
        this.dirtyEntries.length = 0;
        this.createdEntities.length = 0;
        this.destroyedEntities.length = 0;
    }
    /** Track entity creation (full snapshot needed for this entity). */
    markCreated(entityId) {
        this.createdEntities.push(entityId);
    }
    /** Track entity destruction. */
    markDestroyed(entityId) {
        this.destroyedEntities.push(entityId);
    }
    /** Get entities created since last flush. */
    getCreatedEntities() {
        return [...this.createdEntities];
    }
    /** Get entities destroyed since last flush. */
    getDestroyedEntities() {
        return [...this.destroyedEntities];
    }
}
//# sourceMappingURL=DirtyTracker.js.map