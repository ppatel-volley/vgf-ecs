/**
 * Arena Brawl — test systems.
 *
 * Each system is a plain function: (world, dt) => void
 */
import type { World } from "../../core/World.js";
/**
 * MovementSystem (priority 1)
 * Moves entities with Position + Velocity based on speed and angle.
 */
export declare function movementSystem(world: World, dt: number): void;
/**
 * CollisionSystem (priority 2)
 * Detects overlapping entities and pushes them apart.
 * Uses N x N distance checks (no spatial hash).
 */
export declare function collisionSystem(world: World, _dt: number): void;
/**
 * CombatSystem (priority 3)
 * Processes DamageIntent commands from the command queue.
 */
export declare function combatSystem(world: World, _dt: number): void;
/**
 * DeathSystem (priority 4)
 * Entities with Health <= 0 get a Dead component added.
 */
export declare function deathSystem(world: World, _dt: number): void;
//# sourceMappingURL=systems.d.ts.map