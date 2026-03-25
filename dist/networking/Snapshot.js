import { getSerializationName, getComponentByName, } from "./ComponentRegistry.js";
/**
 * Serialise a component or singleton instance to a plain object.
 */
function serialiseObject(obj) {
    const data = {};
    for (const key of Object.keys(obj)) {
        data[key] = obj[key];
    }
    return data;
}
/**
 * Capture a full snapshot of the world state.
 */
export function captureSnapshot(world) {
    const entities = [];
    const registeredComponents = world.getRegisteredComponentTypes();
    for (const entityId of world.getAllEntities()) {
        const parentId = world.getParent(entityId);
        const components = [];
        for (const compType of registeredComponents) {
            const comp = world.getComponent(entityId, compType);
            if (comp) {
                components.push({
                    type: getSerializationName(compType),
                    schemaVersion: 1,
                    data: serialiseObject(comp),
                });
            }
        }
        entities.push({
            id: entityId,
            parentId,
            components,
        });
    }
    const singletons = [];
    for (const [type, data] of world.getAllSingletons()) {
        singletons.push({
            type: getSerializationName(type),
            data: serialiseObject(data),
        });
    }
    return {
        tickCount: world.tickCount,
        time: world.time,
        entities,
        singletons,
    };
}
/**
 * Apply a snapshot to a world — CLEARS the world first, then populates.
 */
export function applySnapshot(world, snapshot) {
    // Clear the world
    world.clear();
    // Set time
    world.time = snapshot.time;
    world.tickCount = snapshot.tickCount;
    // First pass: create all entities (without parents)
    for (const entitySnap of snapshot.entities) {
        world.createEntityWithId(entitySnap.id);
    }
    // Second pass: set up hierarchy
    for (const entitySnap of snapshot.entities) {
        if (entitySnap.parentId !== null && world.isAlive(entitySnap.parentId)) {
            world.setParent(entitySnap.id, entitySnap.parentId);
        }
    }
    // Third pass: add components
    for (const entitySnap of snapshot.entities) {
        for (const compSnap of entitySnap.components) {
            const compClass = getComponentByName(compSnap.type);
            if (compClass) {
                world.addComponent(entitySnap.id, compClass, compSnap.data);
            }
        }
    }
    // Restore singletons
    for (const singletonSnap of snapshot.singletons) {
        const compClass = getComponentByName(singletonSnap.type);
        if (compClass) {
            world.setSingleton(compClass, singletonSnap.data);
        }
    }
}
//# sourceMappingURL=Snapshot.js.map