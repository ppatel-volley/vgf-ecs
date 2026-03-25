/**
 * DeltaEncoder — converts dirty tracker state into serialisable deltas.
 *
 * Reads dirty entries from the world's DirtyTracker, serialises each
 * dirty component, and packages into a WorldDelta.
 */
import type { World } from "../core/World.js";
import type { EntityId } from "../core/Entity.js";
import type { ComponentClass } from "../core/Component.js";
import { getSerializationName, getComponentByName } from "./ComponentRegistry.js";
import { entityIndex } from "../core/Entity.js";

export interface ComponentDelta {
  entityId: number;
  componentType: string;
  schemaVersion: number;
  data: Record<string, unknown>;
}

export interface WorldDelta {
  tickCount: number;
  time: number;
  created: number[];
  destroyed: number[];
  components: ComponentDelta[];
}

/**
 * Serialise a component instance to a plain object.
 * Copies own enumerable properties.
 */
function serialiseComponent(component: object): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(component)) {
    data[key] = (component as Record<string, unknown>)[key];
  }
  return data;
}

export class DeltaEncoder {
  /**
   * Encode current dirty state into a WorldDelta.
   * Reads from the world's dirty tracker.
   */
  encode(world: World): WorldDelta {
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

    const components: ComponentDelta[] = [];
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
  decode(world: World, delta: WorldDelta): void {
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
        } else {
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
