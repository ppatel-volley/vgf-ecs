/**
 * Phase E: Arena Brawl — end-to-end validation mini-game.
 *
 * Exercises every framework feature: entities, components, systems, hierarchy,
 * commands, networking (deltas + snapshots), multi-session, and performance.
 *
 * NO game dependencies — standalone ECS validation.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../core/World.js";
import type { EntityId } from "../core/Entity.js";
import { Transform } from "../hierarchy/Transform.js";
import { hierarchySystem } from "../hierarchy/HierarchySystem.js";
import { SessionWorld } from "../vgf/SessionWorld.js";
import { VGFAdapter } from "../vgf/VGFAdapter.js";
import {
  registerComponentForSerialization,
  clearComponentRegistry,
} from "../networking/ComponentRegistry.js";

import {
  Position,
  Velocity,
  Health,
  CollisionRadius,
  Team,
  Dead,
} from "./arena/components.js";

import {
  movementSystem,
  collisionSystem,
  combatSystem,
  deathSystem,
} from "./arena/systems.js";

// ── Registration helper ──

function registerArenaComponents(): void {
  clearComponentRegistry();
  registerComponentForSerialization("Position", Position);
  registerComponentForSerialization("Velocity", Velocity);
  registerComponentForSerialization("Health", Health);
  registerComponentForSerialization("CollisionRadius", CollisionRadius);
  registerComponentForSerialization("Team", Team);
  registerComponentForSerialization("Dead", Dead);
  registerComponentForSerialization("Transform", Transform);
}

// ── Helper: create an arena fighter ──

function createFighter(
  world: World,
  teamId: number,
  x: number,
  z: number,
  speed: number,
  angle: number,
): EntityId {
  const e = world.createEntity();
  world.addComponent(e, Position, { x, z });
  world.addComponent(e, Velocity, { speed, angle });
  world.addComponent(e, Health, { current: 100, max: 100 });
  world.addComponent(e, CollisionRadius, { radius: 1 });
  world.addComponent(e, Team, { id: teamId });
  return e;
}

// ════════════════════════════════════════════════════════
//  Setup: 2 teams of 4
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Setup", () => {
  beforeEach(registerArenaComponents);

  it("creates 2 teams of 4 entities with all required components", () => {
    const world = new World();

    const team1: EntityId[] = [];
    const team2: EntityId[] = [];

    for (let i = 0; i < 4; i++) {
      team1.push(createFighter(world, 1, i * 3, 0, 5, 0));
      team2.push(createFighter(world, 2, i * 3, 20, 5, Math.PI));
    }

    expect(world.entityCount).toBe(8);

    for (const eid of [...team1, ...team2]) {
      expect(world.hasComponent(eid, Position)).toBe(true);
      expect(world.hasComponent(eid, Velocity)).toBe(true);
      expect(world.hasComponent(eid, Health)).toBe(true);
      expect(world.hasComponent(eid, CollisionRadius)).toBe(true);
      expect(world.hasComponent(eid, Team)).toBe(true);
    }

    // Team assignment correct
    for (const eid of team1) {
      expect(world.getComponent(eid, Team)!.id).toBe(1);
    }
    for (const eid of team2) {
      expect(world.getComponent(eid, Team)!.id).toBe(2);
    }
  });
});

// ════════════════════════════════════════════════════════
//  Movement
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Movement", () => {
  beforeEach(registerArenaComponents);

  it("positions update correctly over 10 ticks", () => {
    const world = new World();
    world.addSystem("MovementSystem", movementSystem, 1);

    const e = createFighter(world, 1, 0, 0, 10, 0);
    const dt = 1 / 60;

    for (let i = 0; i < 10; i++) {
      world.tick(dt);
    }

    const pos = world.getComponent(e, Position)!;
    // Moving at speed 10, angle 0 (positive x): x should be ~10 * (10/60)
    const expected = 10 * 10 * dt;
    expect(pos.x).toBeCloseTo(expected, 4);
    expect(pos.z).toBeCloseTo(0, 4);
  });

  it("angle affects movement direction", () => {
    const world = new World();
    world.addSystem("MovementSystem", movementSystem, 1);

    // Move at angle PI/2 (positive z direction)
    const e = createFighter(world, 1, 0, 0, 10, Math.PI / 2);
    const dt = 0.1;

    world.tick(dt);

    const pos = world.getComponent(e, Position)!;
    expect(pos.x).toBeCloseTo(0, 4);
    expect(pos.z).toBeCloseTo(1, 4);
  });

  it("dead entities do not move", () => {
    const world = new World();
    world.addSystem("MovementSystem", movementSystem, 1);

    const e = createFighter(world, 1, 5, 5, 10, 0);
    world.addComponent(e, Dead, { at: 0 });

    world.tick(0.1);

    const pos = world.getComponent(e, Position)!;
    expect(pos.x).toBe(5);
    expect(pos.z).toBe(5);
  });
});

// ════════════════════════════════════════════════════════
//  Collision
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Collision", () => {
  beforeEach(registerArenaComponents);

  it("two overlapping entities are pushed apart", () => {
    const world = new World();
    world.addSystem("CollisionSystem", collisionSystem, 2);

    const e1 = world.createEntity();
    world.addComponent(e1, Position, { x: 0, z: 0 });
    world.addComponent(e1, CollisionRadius, { radius: 2 });

    const e2 = world.createEntity();
    world.addComponent(e2, Position, { x: 1, z: 0 }); // overlap: distance=1, radii sum=4
    world.addComponent(e2, CollisionRadius, { radius: 2 });

    world.tick(0);

    const pos1 = world.getComponent(e1, Position)!;
    const pos2 = world.getComponent(e2, Position)!;

    // After collision resolution, they should be pushed apart
    const dx = pos2.x - pos1.x;
    const dist = Math.sqrt(dx * dx);
    expect(dist).toBeGreaterThanOrEqual(3.99); // should be at least 4 (sum of radii)
  });

  it("non-overlapping entities are unaffected", () => {
    const world = new World();
    world.addSystem("CollisionSystem", collisionSystem, 2);

    const e1 = world.createEntity();
    world.addComponent(e1, Position, { x: 0, z: 0 });
    world.addComponent(e1, CollisionRadius, { radius: 1 });

    const e2 = world.createEntity();
    world.addComponent(e2, Position, { x: 10, z: 0 });
    world.addComponent(e2, CollisionRadius, { radius: 1 });

    world.tick(0);

    expect(world.getComponent(e1, Position)!.x).toBe(0);
    expect(world.getComponent(e2, Position)!.x).toBe(10);
  });

  it("dead entities are excluded from collision", () => {
    const world = new World();
    world.addSystem("CollisionSystem", collisionSystem, 2);

    const e1 = world.createEntity();
    world.addComponent(e1, Position, { x: 0, z: 0 });
    world.addComponent(e1, CollisionRadius, { radius: 2 });

    const e2 = world.createEntity();
    world.addComponent(e2, Position, { x: 0.5, z: 0 });
    world.addComponent(e2, CollisionRadius, { radius: 2 });
    world.addComponent(e2, Dead, { at: 0 });

    world.tick(0);

    // Positions should be unchanged since e2 is dead
    expect(world.getComponent(e1, Position)!.x).toBe(0);
    expect(world.getComponent(e2, Position)!.x).toBe(0.5);
  });
});

// ════════════════════════════════════════════════════════
//  Combat via Commands
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Combat", () => {
  beforeEach(registerArenaComponents);

  it("DamageIntent command reduces health", () => {
    const world = new World();
    world.addSystem("CombatSystem", combatSystem, 3);

    const target = createFighter(world, 1, 0, 0, 0, 0);

    world.enqueueCommand({
      type: "damage",
      targetId: target,
      amount: 30,
    });

    world.tick(1 / 60);

    expect(world.getComponent(target, Health)!.current).toBe(70);
  });

  it("multiple damage commands accumulate", () => {
    const world = new World();
    world.addSystem("CombatSystem", combatSystem, 3);

    const target = createFighter(world, 1, 0, 0, 0, 0);

    world.enqueueCommand({ type: "damage", targetId: target, amount: 25 });
    world.enqueueCommand({ type: "damage", targetId: target, amount: 25 });

    world.tick(1 / 60);

    expect(world.getComponent(target, Health)!.current).toBe(50);
  });

  it("damage does not go below 0", () => {
    const world = new World();
    world.addSystem("CombatSystem", combatSystem, 3);

    const target = createFighter(world, 1, 0, 0, 0, 0);

    world.enqueueCommand({ type: "damage", targetId: target, amount: 150 });

    world.tick(1 / 60);

    expect(world.getComponent(target, Health)!.current).toBe(0);
  });

  it("damage to dead entity is ignored", () => {
    const world = new World();
    world.addSystem("CombatSystem", combatSystem, 3);

    const target = createFighter(world, 1, 0, 0, 0, 0);
    world.addComponent(target, Dead, { at: 0 });
    world.getComponent(target, Health)!.current = 0;

    world.enqueueCommand({ type: "damage", targetId: target, amount: 50 });
    world.tick(1 / 60);

    expect(world.getComponent(target, Health)!.current).toBe(0);
  });

  it("damage to non-existent entity does not throw", () => {
    const world = new World();
    world.addSystem("CombatSystem", combatSystem, 3);

    world.enqueueCommand({ type: "damage", targetId: 99999, amount: 50 });

    // Should not throw
    world.tick(1 / 60);
    expect(world.getTickErrors().length).toBe(0);
  });
});

// ════════════════════════════════════════════════════════
//  Death
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Death", () => {
  beforeEach(registerArenaComponents);

  it("entity with 0 health gets Dead component", () => {
    const world = new World();
    world.addSystem("CombatSystem", combatSystem, 3);
    world.addSystem("DeathSystem", deathSystem, 4);

    const target = createFighter(world, 1, 0, 0, 0, 0);

    world.enqueueCommand({ type: "damage", targetId: target, amount: 100 });
    world.tick(1 / 60);

    expect(world.hasComponent(target, Dead)).toBe(true);
    expect(world.getComponent(target, Dead)!.at).toBe(1);
  });

  it("entity above 0 health does not get Dead component", () => {
    const world = new World();
    world.addSystem("CombatSystem", combatSystem, 3);
    world.addSystem("DeathSystem", deathSystem, 4);

    const target = createFighter(world, 1, 0, 0, 0, 0);

    world.enqueueCommand({ type: "damage", targetId: target, amount: 50 });
    world.tick(1 / 60);

    expect(world.hasComponent(target, Dead)).toBe(false);
    expect(world.getComponent(target, Health)!.current).toBe(50);
  });

  it("Dead component is not added twice", () => {
    const world = new World();
    world.addSystem("CombatSystem", combatSystem, 3);
    world.addSystem("DeathSystem", deathSystem, 4);

    const target = createFighter(world, 1, 0, 0, 0, 0);

    world.enqueueCommand({ type: "damage", targetId: target, amount: 100 });
    world.tick(1 / 60);

    expect(world.getComponent(target, Dead)!.at).toBe(1);

    // Second tick should not change the Dead.at value
    world.tick(1 / 60);
    expect(world.getComponent(target, Dead)!.at).toBe(1);
  });
});

// ════════════════════════════════════════════════════════
//  Hierarchy
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Hierarchy", () => {
  beforeEach(registerArenaComponents);

  it("parent entity with child entities — world positions update", () => {
    const world = new World();
    world.addSystem("HierarchySystem", hierarchySystem, 0);

    // Ship (parent)
    const ship = world.createEntity();
    world.addComponent(ship, Transform, { localX: 10, localZ: 20, localRotationY: 0 });

    // Turret 1 (child, offset from ship)
    const turret1 = world.createEntity(ship);
    world.addComponent(turret1, Transform, { localX: 2, localZ: 0, localRotationY: 0 });

    // Turret 2 (child, offset from ship)
    const turret2 = world.createEntity(ship);
    world.addComponent(turret2, Transform, { localX: -2, localZ: 0, localRotationY: 0 });

    world.tick(1 / 60);

    const t1 = world.getComponent(turret1, Transform)!;
    const t2 = world.getComponent(turret2, Transform)!;

    expect(t1.worldX).toBeCloseTo(12);
    expect(t1.worldZ).toBeCloseTo(20);
    expect(t2.worldX).toBeCloseTo(8);
    expect(t2.worldZ).toBeCloseTo(20);
  });

  it("moving parent updates children's world positions", () => {
    const world = new World();
    world.addSystem("HierarchySystem", hierarchySystem, 0);

    const parent = world.createEntity();
    world.addComponent(parent, Transform, { localX: 0, localZ: 0 });

    const child = world.createEntity(parent);
    world.addComponent(child, Transform, { localX: 5, localZ: 0 });

    world.tick(1 / 60);
    expect(world.getComponent(child, Transform)!.worldX).toBeCloseTo(5);

    // Move parent
    world.getComponent(parent, Transform)!.localX = 100;
    world.tick(1 / 60);

    expect(world.getComponent(child, Transform)!.worldX).toBeCloseTo(105);
  });

  it("parent rotation affects children's world positions", () => {
    const world = new World();
    world.addSystem("HierarchySystem", hierarchySystem, 0);

    const parent = world.createEntity();
    world.addComponent(parent, Transform, {
      localX: 0,
      localZ: 0,
      localRotationY: Math.PI / 2,
    });

    const child = world.createEntity(parent);
    world.addComponent(child, Transform, { localX: 10, localZ: 0 });

    world.tick(1 / 60);

    const ct = world.getComponent(child, Transform)!;
    // After 90-degree rotation: (10, 0) becomes (0, 10)
    expect(ct.worldX).toBeCloseTo(0, 4);
    expect(ct.worldZ).toBeCloseTo(10, 4);
  });

  it("destroying parent cascades to children", () => {
    const world = new World();
    const parent = world.createEntity();
    const child1 = world.createEntity(parent);
    const child2 = world.createEntity(parent);

    world.addComponent(parent, Health, { current: 100 });
    world.addComponent(child1, Health, { current: 50 });
    world.addComponent(child2, Health, { current: 50 });

    expect(world.entityCount).toBe(3);

    world.destroyEntity(parent);

    expect(world.isAlive(parent)).toBe(false);
    expect(world.isAlive(child1)).toBe(false);
    expect(world.isAlive(child2)).toBe(false);
    expect(world.entityCount).toBe(0);
  });
});

// ════════════════════════════════════════════════════════
//  Networking Round-Trip
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Networking round-trip", () => {
  beforeEach(registerArenaComponents);

  it("server deltas applied to client produce matching state", () => {
    // Server world — use a movement system that marks dirty
    const server = new SessionWorld("server");
    server.addSystem("MovementSystem", (world, dt) => {
      world.each(Position, Velocity, (eid, pos, vel) => {
        if (world.hasComponent(eid, Dead)) return;
        pos.x += Math.cos(vel.angle) * vel.speed * dt;
        pos.z += Math.sin(vel.angle) * vel.speed * dt;
        world.markDirty(eid, Position);
      });
    }, 1);

    const e1 = createFighter(server, 1, 0, 0, 10, 0);
    const e2 = createFighter(server, 2, 50, 50, 5, Math.PI);

    // Client world (passive — no systems)
    const client = new World({ sessionId: "client" });
    client.enableDirtyTracking();

    // Get initial delta (captures entity creation)
    const initialDelta = server.getDelta();
    client.applyDelta(initialDelta);

    // Run 5 ticks on server, capture and apply each delta
    for (let i = 0; i < 5; i++) {
      const delta = server.processTick(1 / 60);
      client.applyDelta(delta);
    }

    // Verify client matches server
    const serverPos1 = server.getComponent(e1, Position)!;
    const clientPos1 = client.getComponent(e1, Position)!;
    expect(clientPos1.x).toBeCloseTo(serverPos1.x, 4);
    expect(clientPos1.z).toBeCloseTo(serverPos1.z, 4);

    const serverPos2 = server.getComponent(e2, Position)!;
    const clientPos2 = client.getComponent(e2, Position)!;
    expect(clientPos2.x).toBeCloseTo(serverPos2.x, 4);
    expect(clientPos2.z).toBeCloseTo(serverPos2.z, 4);
  });

  it("health changes propagate via delta", () => {
    const server = new SessionWorld("server");
    server.addSystem("CombatSystem", combatSystem, 3);
    server.addSystem("DeathSystem", deathSystem, 4);

    const target = createFighter(server, 1, 0, 0, 0, 0);

    const client = new World({ sessionId: "client" });
    client.enableDirtyTracking();

    // Apply initial state
    client.applyDelta(server.getDelta());

    // Damage the target
    server.enqueueCommand({ type: "damage", targetId: target, amount: 60 });
    const delta = server.processTick(1 / 60);
    client.applyDelta(delta);

    // combatSystem now marks health dirty after mutation, so delta carries it
    const clientHealth = client.getComponent(target, Health);
    expect(clientHealth).not.toBeNull();
    expect(clientHealth!.current).toBe(40); // 100 - 60 = 40

    const serverHealth = server.getComponent(target, Health);
    expect(serverHealth!.current).toBe(clientHealth!.current);
  });
});

// ════════════════════════════════════════════════════════
//  Snapshot Recovery
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Snapshot recovery", () => {
  beforeEach(registerArenaComponents);

  it("new client recovers full state from snapshot after 10 ticks", () => {
    const server = new SessionWorld("server");
    server.addSystem("MovementSystem", movementSystem, 1);

    const fighters: EntityId[] = [];
    for (let i = 0; i < 4; i++) {
      fighters.push(createFighter(server, 1, i * 5, 0, 10, 0));
    }

    // Run 10 ticks
    for (let i = 0; i < 10; i++) {
      server.processTick(1 / 60);
    }

    // Capture snapshot
    const snapshot = server.captureSnapshot();

    // New client applies snapshot
    const client = new World({ sessionId: "client-new" });
    client.applySnapshot(snapshot);

    // Verify state matches
    expect(client.entityCount).toBe(server.entityCount);
    expect(client.tickCount).toBe(server.tickCount);
    expect(client.time).toBeCloseTo(server.time, 6);

    for (const eid of fighters) {
      const serverPos = server.getComponent(eid, Position)!;
      const clientPos = client.getComponent(eid, Position)!;
      expect(clientPos.x).toBeCloseTo(serverPos.x, 4);
      expect(clientPos.z).toBeCloseTo(serverPos.z, 4);

      const serverHealth = server.getComponent(eid, Health)!;
      const clientHealth = client.getComponent(eid, Health)!;
      expect(clientHealth.current).toBe(serverHealth.current);
      expect(clientHealth.max).toBe(serverHealth.max);
    }
  });

  it("snapshot preserves hierarchy", () => {
    const server = new World();
    registerArenaComponents();

    const parent = server.createEntity();
    server.addComponent(parent, Position, { x: 10, z: 20 });

    const child = server.createEntity(parent);
    server.addComponent(child, Position, { x: 5, z: 5 });

    const snapshot = server.captureSnapshot();

    const client = new World();
    client.applySnapshot(snapshot);

    expect(client.getParent(child)).toBe(parent);
    expect(client.getChildren(parent)).toContain(child);
    expect(client.getComponent(child, Position)!.x).toBe(5);
  });
});

// ════════════════════════════════════════════════════════
//  Multi-Session
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Multi-session", () => {
  beforeEach(registerArenaComponents);

  it("two VGFAdapter sessions running simultaneously with isolation", () => {
    const adapter = new VGFAdapter();

    // Session A: team 1, moving right
    const worldA = adapter.createWorld("arena-a");
    worldA.addSystem("MovementSystem", movementSystem, 1);
    const fighterA = createFighter(worldA, 1, 0, 0, 10, 0);

    // Session B: team 2, moving left
    const worldB = adapter.createWorld("arena-b");
    worldB.addSystem("MovementSystem", movementSystem, 1);
    const fighterB = createFighter(worldB, 2, 100, 100, 10, Math.PI);

    // Tick both sessions
    for (let i = 0; i < 5; i++) {
      adapter.processTick("arena-a", 1 / 60);
      adapter.processTick("arena-b", 1 / 60);
    }

    // Verify isolation
    const posA = worldA.getComponent(fighterA, Position)!;
    const posB = worldB.getComponent(fighterB, Position)!;

    // Session A fighter moved right
    expect(posA.x).toBeGreaterThan(0);
    // Session B fighter moved left
    expect(posB.x).toBeLessThan(100);

    // Cross-session: session A should NOT see session B's entities
    expect(worldA.entityCount).toBe(1);
    expect(worldB.entityCount).toBe(1);
  });

  it("destroying one session does not affect the other", () => {
    const adapter = new VGFAdapter();

    const worldA = adapter.createWorld("arena-a");
    createFighter(worldA, 1, 0, 0, 0, 0);

    const worldB = adapter.createWorld("arena-b");
    const entityB = createFighter(worldB, 2, 0, 0, 0, 0);

    adapter.destroyWorld("arena-a");

    expect(adapter.hasWorld("arena-a")).toBe(false);
    expect(adapter.hasWorld("arena-b")).toBe(true);
    expect(worldB.entityCount).toBe(1);
    expect(worldB.isAlive(entityB)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════
//  Full System Pipeline
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Full pipeline", () => {
  beforeEach(registerArenaComponents);

  it("movement → collision → combat → death in one tick", () => {
    const world = new World();
    world.addSystem("MovementSystem", movementSystem, 1);
    world.addSystem("CollisionSystem", collisionSystem, 2);
    world.addSystem("CombatSystem", combatSystem, 3);
    world.addSystem("DeathSystem", deathSystem, 4);

    // Two fighters heading towards each other
    const f1 = createFighter(world, 1, 0, 0, 100, 0);
    const f2 = createFighter(world, 2, 5, 0, 100, Math.PI);

    // Damage command kills f2
    world.enqueueCommand({ type: "damage", targetId: f2, amount: 100 });

    world.tick(1 / 60);

    // f2 should be dead
    expect(world.hasComponent(f2, Dead)).toBe(true);

    // f1 should still be alive
    expect(world.hasComponent(f1, Dead)).toBe(false);

    // Both moved (f1 right, f2 left initially — but f2 was still alive during movement)
    expect(world.getComponent(f1, Position)!.x).not.toBe(0);
  });

  it("system errors are captured without halting other systems", () => {
    const world = new World();

    world.addSystem("BuggySystem", () => {
      throw new Error("System crash!");
    }, 0);

    let safeRan = false;
    world.addSystem("SafeSystem", () => {
      safeRan = true;
    }, 1);

    world.tick(1 / 60);

    expect(safeRan).toBe(true);
    expect(world.getTickErrors().length).toBe(1);
    expect(world.getTickErrors()[0].systemName).toBe("BuggySystem");
  });
});

// ════════════════════════════════════════════════════════
//  100-entity Benchmark
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Performance", () => {
  beforeEach(registerArenaComponents);

  it("100 entities, 1000 ticks complete in under 5 seconds", () => {
    const world = new World();
    world.addSystem("MovementSystem", movementSystem, 1);
    world.addSystem("CollisionSystem", collisionSystem, 2);
    world.addSystem("DeathSystem", deathSystem, 4);

    // Create 100 entities spread around the arena
    for (let i = 0; i < 100; i++) {
      const angle = (2 * Math.PI * i) / 100;
      createFighter(
        world,
        i % 2,
        Math.cos(angle) * 50,
        Math.sin(angle) * 50,
        5,
        angle + Math.PI,
      );
    }

    expect(world.entityCount).toBe(100);

    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      world.tick(1 / 60);
    }

    const elapsed = Date.now() - start;

    // Must complete in under 5 seconds
    expect(elapsed).toBeLessThan(5000);
  });
});

// ════════════════════════════════════════════════════════
//  Spatial Query Pattern
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Spatial query pattern", () => {
  beforeEach(registerArenaComponents);

  it("demonstrates N x N distance checks for proximity detection", () => {
    const world = new World();

    // Create entities at known positions
    const e1 = world.createEntity();
    world.addComponent(e1, Position, { x: 0, z: 0 });

    const e2 = world.createEntity();
    world.addComponent(e2, Position, { x: 3, z: 0 });

    const e3 = world.createEntity();
    world.addComponent(e3, Position, { x: 100, z: 100 });

    // Spatial query: find all entities within radius 5 of (0, 0)
    const queryX = 0;
    const queryZ = 0;
    const queryRadius = 5;

    const nearby: EntityId[] = [];
    world.each(Position, (eid, pos) => {
      const dx = pos.x - queryX;
      const dz = pos.z - queryZ;
      if (dx * dx + dz * dz <= queryRadius * queryRadius) {
        nearby.push(eid);
      }
    });

    expect(nearby).toContain(e1);
    expect(nearby).toContain(e2);
    expect(nearby).not.toContain(e3);
  });

  it("pairwise distance check for N entities", () => {
    const world = new World();

    // Create a cluster of entities
    const entities: EntityId[] = [];
    for (let i = 0; i < 10; i++) {
      const e = world.createEntity();
      world.addComponent(e, Position, { x: i * 2, z: 0 });
      world.addComponent(e, CollisionRadius, { radius: 1.5 });
      entities.push(e);
    }

    // Find all overlapping pairs
    const allEntities = world.query(Position, CollisionRadius).execute();
    const overlappingPairs: Array<[EntityId, EntityId]> = [];

    for (let i = 0; i < allEntities.length; i++) {
      const posA = world.getComponent(allEntities[i], Position)!;
      const radA = world.getComponent(allEntities[i], CollisionRadius)!;

      for (let j = i + 1; j < allEntities.length; j++) {
        const posB = world.getComponent(allEntities[j], Position)!;
        const radB = world.getComponent(allEntities[j], CollisionRadius)!;

        const dx = posB.x - posA.x;
        const dz = posB.z - posA.z;
        const distSq = dx * dx + dz * dz;
        const minDist = radA.radius + radB.radius;

        if (distSq < minDist * minDist) {
          overlappingPairs.push([allEntities[i], allEntities[j]]);
        }
      }
    }

    // Adjacent entities (distance = 2, combined radius = 3) should overlap
    expect(overlappingPairs.length).toBe(9); // 9 adjacent pairs in 10 entities
  });
});

// ════════════════════════════════════════════════════════
//  Singleton Integration
// ════════════════════════════════════════════════════════

describe("Arena Brawl — Singletons", () => {
  beforeEach(registerArenaComponents);

  it("arena configuration as a singleton", () => {
    class ArenaConfig {
      radius = 100;
      maxPlayers = 8;
    }

    const world = new World();
    world.setSingleton(ArenaConfig, { radius: 200, maxPlayers: 4 });

    const config = world.getSingleton(ArenaConfig);
    expect(config).not.toBeNull();
    expect(config!.radius).toBe(200);
    expect(config!.maxPlayers).toBe(4);
  });
});
