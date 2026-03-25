/**
 * Phase D: VGF Integration Layer tests.
 *
 * Tests SessionWorld, VGFAdapter, and the CommandQueue integration
 * with VGF-style session management.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { SessionWorld } from "../vgf/SessionWorld.js";
import { VGFAdapter } from "../vgf/VGFAdapter.js";
import { Transform } from "../hierarchy/Transform.js";
import { registerComponentForSerialization, clearComponentRegistry } from "../networking/ComponentRegistry.js";

// ── Test components ──

class Velocity {
  speed = 0;
  angle = 0;
}

class Health {
  current = 100;
  max = 100;
}

// ════════════════════════════════════════════════════════
//  SessionWorld
// ════════════════════════════════════════════════════════

describe("SessionWorld", () => {
  beforeEach(() => {
    clearComponentRegistry();
    registerComponentForSerialization("Transform", Transform);
    registerComponentForSerialization("Velocity", Velocity);
    registerComponentForSerialization("Health", Health);
  });

  it("creates with the given session ID", () => {
    const world = new SessionWorld("session-1");
    expect(world.sessionId).toBe("session-1");
  });

  it("has dirty tracking enabled by default", () => {
    const world = new SessionWorld("session-1");
    expect(world.getDirtyTracker()).not.toBeNull();
  });

  it("extends World — can create entities and add components", () => {
    const world = new SessionWorld("session-1");
    const entity = world.createEntity();
    world.addComponent(entity, Transform, { localX: 10, localZ: 20 });
    const t = world.getComponent(entity, Transform);
    expect(t).not.toBeNull();
    expect(t!.localX).toBe(10);
  });

  it("processTick runs systems and returns a delta", () => {
    const world = new SessionWorld("session-1");

    let systemRan = false;
    world.addSystem("TestSystem", () => {
      systemRan = true;
    }, 0);

    const entity = world.createEntity();
    world.addComponent(entity, Transform, { localX: 5 });
    world.markDirty(entity, Transform);

    // Flush initial creation tracking
    world.getDelta();

    // Now make a change and processTick
    const t = world.getComponent(entity, Transform)!;
    t.localX = 99;
    world.markDirty(entity, Transform);

    const delta = world.processTick(1 / 60);

    expect(systemRan).toBe(true);
    expect(delta.tickCount).toBe(1);
    expect(delta.components.length).toBeGreaterThanOrEqual(1);
  });

  it("processTick advances time correctly", () => {
    const world = new SessionWorld("session-1");
    world.processTick(0.5);
    expect(world.time).toBeCloseTo(0.5);
    expect(world.tickCount).toBe(1);

    world.processTick(0.25);
    expect(world.time).toBeCloseTo(0.75);
    expect(world.tickCount).toBe(2);
  });

  it("processTick flushes dirty tracker after delta", () => {
    const world = new SessionWorld("session-1");
    const entity = world.createEntity();
    world.addComponent(entity, Transform, { localX: 1 });

    const delta1 = world.processTick(1 / 60);
    // First tick should have the created entity
    expect(delta1.created.length).toBe(1);

    // Second tick with no changes should be empty
    const delta2 = world.processTick(1 / 60);
    expect(delta2.created.length).toBe(0);
    expect(delta2.components.length).toBe(0);
  });

  it("processTick includes entity creation in delta", () => {
    const world = new SessionWorld("session-1");

    // Add a system that creates entities
    world.addSystem("SpawnSystem", (w) => {
      const e = w.createEntity();
      w.addComponent(e, Health, { current: 50, max: 100 });
    }, 0);

    const delta = world.processTick(1 / 60);
    expect(delta.created.length).toBeGreaterThanOrEqual(1);
  });
});

// ════════════════════════════════════════════════════════
//  VGFAdapter
// ════════════════════════════════════════════════════════

describe("VGFAdapter", () => {
  beforeEach(() => {
    clearComponentRegistry();
    registerComponentForSerialization("Transform", Transform);
    registerComponentForSerialization("Velocity", Velocity);
    registerComponentForSerialization("Health", Health);
  });

  it("createWorld creates a new world", () => {
    const adapter = new VGFAdapter();
    expect(adapter.hasWorld("session-1")).toBe(false);

    const world = adapter.createWorld("session-1");
    expect(world).toBeInstanceOf(SessionWorld);
    expect(adapter.hasWorld("session-1")).toBe(true);
  });

  it("createWorld throws if world already exists", () => {
    const adapter = new VGFAdapter();
    adapter.createWorld("session-1");
    expect(() => adapter.createWorld("session-1")).toThrow("already exists");
  });

  it("getWorld returns existing world", () => {
    const adapter = new VGFAdapter();
    const world1 = adapter.createWorld("session-1");
    const world2 = adapter.getWorld("session-1");
    expect(world1).toBe(world2);
  });

  it("getWorld throws if world does not exist", () => {
    const adapter = new VGFAdapter();
    expect(() => adapter.getWorld("nonexistent")).toThrow("No world found");
  });

  it("getOrCreateWorld creates on first call, returns same on second", () => {
    const adapter = new VGFAdapter();
    const world1 = adapter.getOrCreateWorld("session-1");
    const world2 = adapter.getOrCreateWorld("session-1");
    expect(world1).toBe(world2);
  });

  it("creates different worlds for different session IDs", () => {
    const adapter = new VGFAdapter();
    const worldA = adapter.createWorld("session-a");
    const worldB = adapter.createWorld("session-b");
    expect(worldA).not.toBe(worldB);
    expect(worldA.sessionId).toBe("session-a");
    expect(worldB.sessionId).toBe("session-b");
  });

  it("destroyWorld removes the world", () => {
    const adapter = new VGFAdapter();
    adapter.createWorld("session-1");
    expect(adapter.sessionCount).toBe(1);

    adapter.destroyWorld("session-1");
    expect(adapter.hasWorld("session-1")).toBe(false);
    expect(adapter.sessionCount).toBe(0);
  });

  it("destroyWorld is idempotent for non-existent sessions", () => {
    const adapter = new VGFAdapter();
    // Should not throw
    adapter.destroyWorld("non-existent");
    expect(adapter.sessionCount).toBe(0);
  });

  it("destroyWorld clears the world state", () => {
    const adapter = new VGFAdapter();
    const world = adapter.createWorld("session-1");
    const entity = world.createEntity();
    world.addComponent(entity, Health, { current: 50 });
    expect(world.entityCount).toBe(1);

    adapter.destroyWorld("session-1");

    // New world for same session should be fresh
    const newWorld = adapter.createWorld("session-1");
    expect(newWorld).not.toBe(world);
    expect(newWorld.entityCount).toBe(0);
  });

  it("processTick returns correct deltas", () => {
    const adapter = new VGFAdapter();
    const world = adapter.createWorld("session-1");
    const entity = world.createEntity();
    world.addComponent(entity, Transform, { localX: 10 });

    const delta = adapter.processTick("session-1", 1 / 60);
    expect(delta.tickCount).toBe(1);
    expect(delta.created.length).toBeGreaterThanOrEqual(1);
  });

  it("multiple sessions are fully isolated", () => {
    const adapter = new VGFAdapter();

    // Session A: create an entity with Health
    const worldA = adapter.createWorld("session-a");
    const entityA = worldA.createEntity();
    worldA.addComponent(entityA, Health, { current: 50 });

    // Session B: create a different entity with Transform
    const worldB = adapter.createWorld("session-b");
    const entityB = worldB.createEntity();
    worldB.addComponent(entityB, Transform, { localX: 99 });

    // Verify isolation
    expect(worldA.entityCount).toBe(1);
    expect(worldB.entityCount).toBe(1);
    expect(worldA.hasComponent(entityA, Health)).toBe(true);
    expect(worldA.hasComponent(entityA, Transform)).toBe(false);
    expect(worldB.hasComponent(entityB, Transform)).toBe(true);
    expect(worldB.hasComponent(entityB, Health)).toBe(false);
  });

  it("getSessionIds returns all active sessions", () => {
    const adapter = new VGFAdapter();
    adapter.createWorld("alpha");
    adapter.createWorld("beta");
    adapter.createWorld("gamma");

    const ids = adapter.getSessionIds();
    expect(ids).toContain("alpha");
    expect(ids).toContain("beta");
    expect(ids).toContain("gamma");
    expect(ids.length).toBe(3);
  });

  it("sessionCount tracks active session count", () => {
    const adapter = new VGFAdapter();
    expect(adapter.sessionCount).toBe(0);

    adapter.createWorld("a");
    expect(adapter.sessionCount).toBe(1);

    adapter.createWorld("b");
    expect(adapter.sessionCount).toBe(2);

    adapter.destroyWorld("a");
    expect(adapter.sessionCount).toBe(1);
  });
});

// ════════════════════════════════════════════════════════
//  CommandQueue Integration
// ════════════════════════════════════════════════════════

describe("CommandQueue integration with SessionWorld", () => {
  it("enqueue command → system reads it → cleared after tick", () => {
    const world = new SessionWorld("session-cmd");
    const processed: string[] = [];

    world.addSystem("CommandHandler", (w) => {
      for (const cmd of w.getCommands("fire_cannon")) {
        processed.push(cmd.targetId as string);
      }
    }, 0);

    world.enqueueCommand({ type: "fire_cannon", targetId: "enemy-1" });
    world.enqueueCommand({ type: "fire_cannon", targetId: "enemy-2" });
    world.enqueueCommand({ type: "dock", portId: "port-1" });

    world.processTick(1 / 60);

    // Commands should have been processed
    expect(processed).toEqual(["enemy-1", "enemy-2"]);

    // Commands should be cleared after tick
    expect(world.getCommands("fire_cannon").length).toBe(0);
    expect(world.getCommands("dock").length).toBe(0);
  });

  it("commands enqueued via adapter reach the correct world", () => {
    const adapter = new VGFAdapter();
    const worldA = adapter.createWorld("session-a");
    const worldB = adapter.createWorld("session-b");

    const processedA: string[] = [];
    const processedB: string[] = [];

    worldA.addSystem("CmdA", (w) => {
      for (const cmd of w.getCommands("move")) {
        processedA.push(cmd.direction as string);
      }
    }, 0);

    worldB.addSystem("CmdB", (w) => {
      for (const cmd of w.getCommands("move")) {
        processedB.push(cmd.direction as string);
      }
    }, 0);

    worldA.enqueueCommand({ type: "move", direction: "north" });
    worldB.enqueueCommand({ type: "move", direction: "south" });

    adapter.processTick("session-a", 1 / 60);
    adapter.processTick("session-b", 1 / 60);

    expect(processedA).toEqual(["north"]);
    expect(processedB).toEqual(["south"]);
  });

  it("multiple command types processed by different systems", () => {
    const world = new SessionWorld("session-multi");
    const fireResults: number[] = [];
    const healResults: number[] = [];

    world.addSystem("FireHandler", (w) => {
      for (const cmd of w.getCommands("fire")) {
        fireResults.push(cmd.damage as number);
      }
    }, 1);

    world.addSystem("HealHandler", (w) => {
      for (const cmd of w.getCommands("heal")) {
        healResults.push(cmd.amount as number);
      }
    }, 2);

    world.enqueueCommand({ type: "fire", damage: 25 });
    world.enqueueCommand({ type: "heal", amount: 10 });
    world.enqueueCommand({ type: "fire", damage: 50 });

    world.processTick(1 / 60);

    expect(fireResults).toEqual([25, 50]);
    expect(healResults).toEqual([10]);
  });
});

// ════════════════════════════════════════════════════════
//  Session Cleanup
// ════════════════════════════════════════════════════════

describe("Session cleanup", () => {
  it("destroyWorld removes all entities and components", () => {
    const adapter = new VGFAdapter();
    const world = adapter.createWorld("session-cleanup");

    // Create a hierarchy
    const parent = world.createEntity();
    const child = world.createEntity(parent);
    world.addComponent(parent, Transform, { localX: 1 });
    world.addComponent(child, Health, { current: 75 });

    expect(world.entityCount).toBe(2);

    adapter.destroyWorld("session-cleanup");
    expect(adapter.hasWorld("session-cleanup")).toBe(false);
  });

  it("destroying one session does not affect others", () => {
    const adapter = new VGFAdapter();
    const worldA = adapter.createWorld("session-keep");
    const worldB = adapter.createWorld("session-remove");

    const entityA = worldA.createEntity();
    worldA.addComponent(entityA, Health, { current: 100 });

    worldB.createEntity();

    adapter.destroyWorld("session-remove");

    // Session A should be unaffected
    expect(adapter.hasWorld("session-keep")).toBe(true);
    expect(worldA.entityCount).toBe(1);
    expect(worldA.getComponent(entityA, Health)!.current).toBe(100);
  });
});
