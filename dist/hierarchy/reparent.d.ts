/**
 * Reparent utility functions for entity hierarchy manipulation.
 */
import type { World } from "../core/World.js";
import type { EntityId } from "../core/Entity.js";
/**
 * Move an entity to a new parent.
 * Removes from old parent (if any) and adds to new parent.
 */
export declare function reparent(world: World, childId: EntityId, newParentId: EntityId): void;
/**
 * Detach an entity from its parent, making it a root entity.
 */
export declare function detach(world: World, childId: EntityId): void;
/**
 * Get the world-space position and rotation from an entity's Transform.
 * Returns null if the entity has no Transform component.
 */
export declare function getWorldPosition(world: World, entityId: EntityId): {
    x: number;
    z: number;
    rotationY: number;
} | null;
//# sourceMappingURL=reparent.d.ts.map