/**
 * DirtyTracker — tracks which components on which entities have changed since last flush.
 *
 * Used by the delta encoder to produce minimal network updates.
 * Opt-in via world.enableDirtyTracking().
 */
import type { EntityId } from "../core/Entity.js";
import type { ComponentClass } from "../core/Component.js";
import { getComponentId } from "../core/Component.js";

export interface DirtyEntry {
  entityId: EntityId;
  componentType: ComponentClass;
}

export class DirtyTracker {
  /** Set of "entityId:componentId" strings for deduplication. */
  private readonly dirtySet = new Set<string>();
  private readonly dirtyEntries: DirtyEntry[] = [];

  private readonly createdEntities: EntityId[] = [];
  private readonly destroyedEntities: EntityId[] = [];

  /** Mark a specific component on an entity as dirty. */
  markDirty(entityId: EntityId, componentType: ComponentClass): void {
    const key = `${entityId}:${getComponentId(componentType)}`;
    if (this.dirtySet.has(key)) return; // coalesce duplicates
    this.dirtySet.add(key);
    this.dirtyEntries.push({ entityId, componentType });
  }

  /** Get all dirty entries since last flush. */
  getDirtyEntries(): DirtyEntry[] {
    return [...this.dirtyEntries];
  }

  /** Clear all dirty flags (called after serialisation). */
  flush(): void {
    this.dirtySet.clear();
    this.dirtyEntries.length = 0;
    this.createdEntities.length = 0;
    this.destroyedEntities.length = 0;
  }

  /** Track entity creation (full snapshot needed for this entity). */
  markCreated(entityId: EntityId): void {
    this.createdEntities.push(entityId);
  }

  /** Track entity destruction. */
  markDestroyed(entityId: EntityId): void {
    this.destroyedEntities.push(entityId);
  }

  /** Get entities created since last flush. */
  getCreatedEntities(): EntityId[] {
    return [...this.createdEntities];
  }

  /** Get entities destroyed since last flush. */
  getDestroyedEntities(): EntityId[] {
    return [...this.destroyedEntities];
  }
}
