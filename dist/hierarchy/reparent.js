import { Transform } from "./Transform.js";
/**
 * Move an entity to a new parent.
 * Removes from old parent (if any) and adds to new parent.
 */
export function reparent(world, childId, newParentId) {
    // removeParent is handled internally by setParent
    world.setParent(childId, newParentId);
}
/**
 * Detach an entity from its parent, making it a root entity.
 */
export function detach(world, childId) {
    world.removeParent(childId);
}
/**
 * Get the world-space position and rotation from an entity's Transform.
 * Returns null if the entity has no Transform component.
 */
export function getWorldPosition(world, entityId) {
    const transform = world.getComponent(entityId, Transform);
    if (!transform)
        return null;
    return {
        x: transform.worldX,
        z: transform.worldZ,
        rotationY: transform.worldRotationY,
    };
}
//# sourceMappingURL=reparent.js.map