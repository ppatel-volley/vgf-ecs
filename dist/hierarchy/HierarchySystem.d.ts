/**
 * HierarchySystem — computes world-space transforms from the entity hierarchy.
 *
 * Traverses top-down: roots first, then children recursively.
 * Ensures parents are always computed before their children.
 */
import type { World } from "../core/World.js";
/**
 * System function that computes world-space transforms from the hierarchy.
 * Register with: world.addSystem("HierarchySystem", hierarchySystem, 0)
 */
export declare function hierarchySystem(world: World, _dt: number): void;
//# sourceMappingURL=HierarchySystem.d.ts.map