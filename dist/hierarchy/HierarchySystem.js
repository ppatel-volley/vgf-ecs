import { Transform } from "./Transform.js";
/**
 * Process a single entity and its children recursively.
 * The parent's world transform must already be computed.
 */
function processEntity(world, entityId, parentTransform) {
    const transform = world.getComponent(entityId, Transform);
    if (!transform)
        return;
    if (parentTransform) {
        const cosR = Math.cos(parentTransform.worldRotationY);
        const sinR = Math.sin(parentTransform.worldRotationY);
        transform.worldX =
            parentTransform.worldX +
                transform.localX * cosR -
                transform.localZ * sinR;
        transform.worldZ =
            parentTransform.worldZ +
                transform.localX * sinR +
                transform.localZ * cosR;
        transform.worldRotationY =
            parentTransform.worldRotationY + transform.localRotationY;
    }
    else {
        // Root entity: world = local
        transform.worldX = transform.localX;
        transform.worldZ = transform.localZ;
        transform.worldRotationY = transform.localRotationY;
    }
    // Process children recursively
    const children = world.getChildren(entityId);
    for (const childId of children) {
        processEntity(world, childId, transform);
    }
}
/**
 * System function that computes world-space transforms from the hierarchy.
 * Register with: world.addSystem("HierarchySystem", hierarchySystem, 0)
 */
export function hierarchySystem(world, _dt) {
    // Find all entities with Transform
    const entities = world.query(Transform).execute();
    // Identify roots: entities with no parent, or parent without Transform
    for (const entityId of entities) {
        const parent = world.getParent(entityId);
        if (parent === null || !world.hasComponent(parent, Transform)) {
            // This is a root — process it and its descendants
            processEntity(world, entityId, null);
        }
    }
}
//# sourceMappingURL=HierarchySystem.js.map