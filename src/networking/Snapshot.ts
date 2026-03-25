/**
 * Snapshot — full world serialisation for initial sync and reconnection.
 *
 * captureSnapshot: serialises all entities, components, hierarchy, and singletons.
 * applySnapshot: clears the world and populates from the snapshot.
 */
import type { World } from "../core/World.js";
import type { EntityId } from "../core/Entity.js";
import type { ComponentClass } from "../core/Component.js";
import {
  getSerializationName,
  getComponentByName,
} from "./ComponentRegistry.js";

export interface ComponentSnapshot {
  type: string;
  schemaVersion: number;
  data: Record<string, unknown>;
}

export interface EntitySnapshot {
  id: number;
  parentId: number | null;
  components: ComponentSnapshot[];
}

export interface SingletonSnapshot {
  type: string;
  data: Record<string, unknown>;
}

export interface WorldSnapshot {
  tickCount: number;
  time: number;
  entities: EntitySnapshot[];
  singletons: SingletonSnapshot[];
}

/**
 * Serialise a component or singleton instance to a plain object.
 */
function serialiseObject(obj: object): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    data[key] = (obj as Record<string, unknown>)[key];
  }
  return data;
}

/**
 * Capture a full snapshot of the world state.
 */
export function captureSnapshot(world: World): WorldSnapshot {
  const entities: EntitySnapshot[] = [];
  const registeredComponents = world.getRegisteredComponentTypes();

  for (const entityId of world.getAllEntities()) {
    const parentId = world.getParent(entityId);
    const components: ComponentSnapshot[] = [];

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

  const singletons: SingletonSnapshot[] = [];
  for (const [type, data] of world.getAllSingletons()) {
    singletons.push({
      type: getSerializationName(type),
      data: serialiseObject(data as object),
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
export function applySnapshot(world: World, snapshot: WorldSnapshot): void {
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
