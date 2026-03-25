import { Position } from "./components.js";
import { Velocity } from "./components.js";
import { Health } from "./components.js";
import { CollisionRadius } from "./components.js";
import { Dead } from "./components.js";
/**
 * MovementSystem (priority 1)
 * Moves entities with Position + Velocity based on speed and angle.
 */
export function movementSystem(world, dt) {
    world.each(Position, Velocity, (eid, pos, vel) => {
        // Skip dead entities
        if (world.hasComponent(eid, Dead))
            return;
        pos.x += Math.cos(vel.angle) * vel.speed * dt;
        pos.z += Math.sin(vel.angle) * vel.speed * dt;
    });
}
/**
 * CollisionSystem (priority 2)
 * Detects overlapping entities and pushes them apart.
 * Uses N x N distance checks (no spatial hash).
 */
export function collisionSystem(world, _dt) {
    const entities = world.query(Position, CollisionRadius).execute();
    for (let i = 0; i < entities.length; i++) {
        const eidA = entities[i];
        if (world.hasComponent(eidA, Dead))
            continue;
        const posA = world.getComponent(eidA, Position);
        const radA = world.getComponent(eidA, CollisionRadius);
        for (let j = i + 1; j < entities.length; j++) {
            const eidB = entities[j];
            if (world.hasComponent(eidB, Dead))
                continue;
            const posB = world.getComponent(eidB, Position);
            const radB = world.getComponent(eidB, CollisionRadius);
            const dx = posB.x - posA.x;
            const dz = posB.z - posA.z;
            const distSq = dx * dx + dz * dz;
            const minDist = radA.radius + radB.radius;
            if (distSq < minDist * minDist && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const overlap = minDist - dist;
                const nx = dx / dist;
                const nz = dz / dist;
                const half = overlap / 2;
                posA.x -= nx * half;
                posA.z -= nz * half;
                posB.x += nx * half;
                posB.z += nz * half;
            }
        }
    }
}
/**
 * CombatSystem (priority 3)
 * Processes DamageIntent commands from the command queue.
 */
export function combatSystem(world, _dt) {
    for (const cmd of world.getCommands("damage")) {
        const targetId = cmd.targetId;
        const amount = cmd.amount;
        if (!world.isAlive(targetId))
            continue;
        const health = world.getComponent(targetId, Health);
        if (!health)
            continue;
        if (world.hasComponent(targetId, Dead))
            continue;
        health.current = Math.max(0, health.current - amount);
        world.markDirty(targetId, Health);
    }
}
/**
 * DeathSystem (priority 4)
 * Entities with Health <= 0 get a Dead component added.
 */
export function deathSystem(world, _dt) {
    world.each(Health, (eid, health) => {
        if (health.current <= 0 && !world.hasComponent(eid, Dead)) {
            world.addComponent(eid, Dead, { at: world.tickCount });
        }
    });
}
//# sourceMappingURL=systems.js.map