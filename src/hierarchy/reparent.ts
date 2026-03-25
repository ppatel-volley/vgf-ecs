/**
 * Reparent utility functions for entity hierarchy manipulation.
 */
import type { World } from "../core/World.js";
import type { EntityId } from "../core/Entity.js";
import { Transform } from "./Transform.js";

/**
 * Move an entity to a new parent.
 * Removes from old parent (if any) and adds to new parent.
 */
export function reparent(
  world: World,
  childId: EntityId,
  newParentId: EntityId,
): void {
  // removeParent is handled internally by setParent
  world.setParent(childId, newParentId);
}

/**
 * Detach an entity from its parent, making it a root entity.
 */
export function detach(world: World, childId: EntityId): void {
  world.removeParent(childId);
}

/**
 * Get the world-space position and rotation from an entity's Transform.
 * Returns null if the entity has no Transform component.
 */
export function getWorldPosition(
  world: World,
  entityId: EntityId,
): { x: number; z: number; rotationY: number } | null {
  const transform = world.getComponent(entityId, Transform);
  if (!transform) return null;
  return {
    x: transform.worldX,
    z: transform.worldZ,
    rotationY: transform.worldRotationY,
  };
}
