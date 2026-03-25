import { getSerializationName, getComponentByName } from "./ComponentRegistry.js";
/**
 * Serialise a component instance to a plain object.
 * Copies own enumerable properties.
 */
function serialiseComponent(component) {
    const data = {};
    for (const key of Object.keys(component)) {
        data[key] = component[key];
    }
    return data;
}
export class DeltaEncoder {
    /**
     * Encode current dirty state into a WorldDelta.
     * Reads from the world's dirty tracker.
     */
    encode(world) {
        const tracker = world.getDirtyTracker();
        if (!tracker) {
            return {
                tickCount: world.tickCount,
                time: world.time,
                created: [],
                destroyed: [],
                components: [],
            };
        }
        const components = [];
        for (const entry of tracker.getDirtyEntries()) {
            const component = world.getComponent(entry.entityId, entry.componentType);
            if (component) {
                components.push({
                    entityId: entry.entityId,
                    componentType: getSerializationName(entry.componentType),
                    schemaVersion: 1,
                    data: serialiseComponent(component),
                });
            }
        }
        return {
            tickCount: world.tickCount,
            time: world.time,
            created: [...tracker.getCreatedEntities()],
            destroyed: [...tracker.getDestroyedEntities()],
            components,
        };
    }
    /**
     * Apply a WorldDelta to a world (client-side).
     * Creates entities, destroys entities, upserts components.
     */
    decode(world, delta) {
        // Create new entities
        for (const entityId of delta.created) {
            world.createEntityWithId(entityId);
        }
        // Apply component changes
        for (const compDelta of delta.components) {
            const componentClass = getComponentByName(compDelta.componentType);
            if (!componentClass) {
                continue; // Skip unknown component types
            }
            if (world.isAlive(compDelta.entityId)) {
                if (world.hasComponent(compDelta.entityId, componentClass)) {
                    // Update existing component
                    const existing = world.getComponent(compDelta.entityId, componentClass);
                    if (existing) {
                        Object.assign(existing, compDelta.data);
                    }
                }
                else {
                    // Add new component
                    world.addComponent(compDelta.entityId, componentClass, compDelta.data);
                }
            }
        }
        // Destroy entities
        for (const entityId of delta.destroyed) {
            if (world.isAlive(entityId)) {
                world.destroyEntity(entityId);
            }
        }
    }
}
//# sourceMappingURL=DeltaEncoder.js.map