import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../core/World.js";
import { captureSnapshot, applySnapshot } from "../networking/Snapshot.js";
import {
  registerComponentForSerialization,
  clearComponentRegistry,
} from "../networking/ComponentRegistry.js";
import { Transform } from "../hierarchy/Transform.js";

class Health {
  hp = 100;
  maxHp = 100;
}

class GameConfig {
  arenaRadius = 500;
  maxPlayers = 4;
}

describe("Snapshot", () => {
  beforeEach(() => {
    clearComponentRegistry();
    registerComponentForSerialization("Transform", Transform);
    registerComponentForSerialization("Health", Health);
    registerComponentForSerialization("GameConfig", GameConfig);
  });

  it("capture: all entities with components serialised", () => {
    const world = new World();
    const e1 = world.createEntity();
    world.addComponent(e1, Transform, { localX: 10, localZ: 20 });
    world.addComponent(e1, Health, { hp: 80 });

    const e2 = world.createEntity();
    world.addComponent(e2, Transform, { localX: 30, localZ: 40 });

    const snapshot = captureSnapshot(world);
    expect(snapshot.entities).toHaveLength(2);

    const e1Snap = snapshot.entities.find((e) => e.id === e1)!;
    expect(e1Snap.components).toHaveLength(2);

    const transformSnap = e1Snap.components.find((c) => c.type === "Transform")!;
    expect(transformSnap.data.localX).toBe(10);
  });

  it("capture: hierarchy (parent-child) preserved", () => {
    const world = new World();
    const parent = world.createEntity();
    const child = world.createEntity(parent);

    world.addComponent(parent, Transform, { localX: 100 });
    world.addComponent(child, Transform, { localX: 50 });

    const snapshot = captureSnapshot(world);
    const childSnap = snapshot.entities.find((e) => e.id === child)!;
    expect(childSnap.parentId).toBe(parent);

    const parentSnap = snapshot.entities.find((e) => e.id === parent)!;
    expect(parentSnap.parentId).toBeNull();
  });

  it("capture: singletons included", () => {
    const world = new World();
    world.setSingleton(GameConfig, { arenaRadius: 300, maxPlayers: 6 });

    const snapshot = captureSnapshot(world);
    expect(snapshot.singletons).toHaveLength(1);
    expect(snapshot.singletons[0].type).toBe("GameConfig");
    expect(snapshot.singletons[0].data.arenaRadius).toBe(300);
  });

  it("apply: empty world populated from snapshot", () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, Transform, { localX: 42, localZ: 7 });
    world.tick(1); // advance time

    const snapshot = captureSnapshot(world);

    const clientWorld = new World();
    applySnapshot(clientWorld, snapshot);

    expect(clientWorld.isAlive(e)).toBe(true);
    const t = clientWorld.getComponent(e, Transform)!;
    expect(t.localX).toBe(42);
    expect(t.localZ).toBe(7);
  });

  it("apply: hierarchy restored correctly", () => {
    const world = new World();
    const parent = world.createEntity();
    world.addComponent(parent, Transform, { localX: 100 });
    const child = world.createEntity(parent);
    world.addComponent(child, Transform, { localX: 50 });

    const snapshot = captureSnapshot(world);

    const clientWorld = new World();
    applySnapshot(clientWorld, snapshot);

    expect(clientWorld.getParent(child)).toBe(parent);
    expect(clientWorld.getChildren(parent)).toContain(child);
  });

  it("round-trip: capture then apply on second world — both match", () => {
    const serverWorld = new World();
    const e1 = serverWorld.createEntity();
    serverWorld.addComponent(e1, Transform, { localX: 10, localZ: 20 });
    serverWorld.addComponent(e1, Health, { hp: 50, maxHp: 100 });

    const e2 = serverWorld.createEntity(e1);
    serverWorld.addComponent(e2, Transform, { localX: 5, localZ: 3 });

    serverWorld.setSingleton(GameConfig, { arenaRadius: 200, maxPlayers: 2 });
    for (let i = 0; i < 5; i++) {
      serverWorld.tick(1);
    }

    const snapshot = captureSnapshot(serverWorld);

    const clientWorld = new World();
    applySnapshot(clientWorld, snapshot);

    // Verify entities
    expect(clientWorld.isAlive(e1)).toBe(true);
    expect(clientWorld.isAlive(e2)).toBe(true);

    // Verify components
    const t1 = clientWorld.getComponent(e1, Transform)!;
    expect(t1.localX).toBe(10);
    const h1 = clientWorld.getComponent(e1, Health)!;
    expect(h1.hp).toBe(50);

    // Verify hierarchy
    expect(clientWorld.getParent(e2)).toBe(e1);

    // Verify singletons
    const config = clientWorld.getSingleton(GameConfig)!;
    expect(config.arenaRadius).toBe(200);

    // Verify time
    expect(clientWorld.tickCount).toBe(5);
  });

  it("apply clears existing state before populating", () => {
    const clientWorld = new World();
    const oldEntity = clientWorld.createEntity();
    clientWorld.addComponent(oldEntity, Health, { hp: 999 });

    // Apply empty snapshot
    const snapshot = captureSnapshot(new World());
    applySnapshot(clientWorld, snapshot);

    // Old entity should be gone
    expect(clientWorld.isAlive(oldEntity)).toBe(false);
    expect(clientWorld.entityCount).toBe(0);
  });

  it("capture: tickCount and time preserved", () => {
    const world = new World();
    world.tick(0.016);
    world.tick(0.016);
    world.tick(0.016);

    const snapshot = captureSnapshot(world);
    expect(snapshot.tickCount).toBe(3);
    expect(snapshot.time).toBeCloseTo(0.048);
  });

  it("capture: empty world produces empty snapshot", () => {
    const world = new World();
    const snapshot = captureSnapshot(world);
    expect(snapshot.entities).toHaveLength(0);
    expect(snapshot.singletons).toHaveLength(0);
  });

  it("apply: singletons restored", () => {
    const world = new World();
    world.setSingleton(GameConfig, { arenaRadius: 999, maxPlayers: 8 });

    const snapshot = captureSnapshot(world);
    const clientWorld = new World();
    applySnapshot(clientWorld, snapshot);

    const config = clientWorld.getSingleton(GameConfig)!;
    expect(config.arenaRadius).toBe(999);
    expect(config.maxPlayers).toBe(8);
  });
});
