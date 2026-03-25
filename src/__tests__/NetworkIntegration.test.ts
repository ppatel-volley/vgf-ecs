import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../core/World.js";
import { Transform } from "../hierarchy/Transform.js";
import { hierarchySystem } from "../hierarchy/HierarchySystem.js";
import { DeltaEncoder } from "../networking/DeltaEncoder.js";
import {
  registerComponentForSerialization,
  clearComponentRegistry,
} from "../networking/ComponentRegistry.js";
import { captureSnapshot, applySnapshot } from "../networking/Snapshot.js";

class Velocity {
  speed = 0;
  dx = 0;
  dz = 0;
}

class Health {
  hp = 100;
}

function movementSystem(world: World, dt: number): void {
  world.each(Transform, Velocity, (eid, t, v) => {
    t.localX += v.dx * dt;
    t.localZ += v.dz * dt;
    world.markDirty(eid, Transform);
  });
}

describe("Network Integration", () => {
  let encoder: DeltaEncoder;

  beforeEach(() => {
    clearComponentRegistry();
    registerComponentForSerialization("Transform", Transform);
    registerComponentForSerialization("Velocity", Velocity);
    registerComponentForSerialization("Health", Health);
    encoder = new DeltaEncoder();
  });

  it("server world ticks, produces deltas, client applies deltas — states converge", () => {
    const server = new World();
    server.enableDirtyTracking();
    server.addSystem("Movement", movementSystem, 1);
    server.addSystem("Hierarchy", hierarchySystem, 0);

    const e = server.createEntity();
    server.addComponent(e, Transform, { localX: 0, localZ: 0 });
    server.addComponent(e, Velocity, { dx: 10, dz: 5 });

    // Get initial delta (entity creation + components)
    const initDelta = server.getDelta();

    const client = new World();
    client.applyDelta(initDelta);

    // Tick server and send delta
    server.tick(1);
    const delta1 = server.getDelta();
    client.applyDelta(delta1);

    const serverPos = server.getComponent(e, Transform)!;
    const clientPos = client.getComponent(e, Transform)!;
    expect(clientPos.localX).toBe(serverPos.localX);
    expect(clientPos.localZ).toBe(serverPos.localZ);
  });

  it("multiple ticks: deltas accumulate correctly", () => {
    const server = new World();
    server.enableDirtyTracking();
    server.addSystem("Movement", movementSystem, 1);

    const e = server.createEntity();
    server.addComponent(e, Transform, { localX: 0, localZ: 0 });
    server.addComponent(e, Velocity, { dx: 1, dz: 0 });

    const client = new World();
    client.applyDelta(server.getDelta());

    for (let i = 0; i < 5; i++) {
      server.tick(1);
      client.applyDelta(server.getDelta());
    }

    const serverPos = server.getComponent(e, Transform)!;
    const clientPos = client.getComponent(e, Transform)!;
    expect(serverPos.localX).toBe(5);
    expect(clientPos.localX).toBe(5);
  });

  it("entity create on server appears on client via delta", () => {
    const server = new World();
    server.enableDirtyTracking();

    // Flush initial empty state
    server.getDelta();

    const e = server.createEntity();
    server.addComponent(e, Transform, { localX: 42 });

    const delta = server.getDelta();

    const client = new World();
    client.applyDelta(delta);

    expect(client.isAlive(e)).toBe(true);
    expect(client.getComponent(e, Transform)!.localX).toBe(42);
  });

  it("entity destroy on server removed on client via delta", () => {
    const server = new World();
    server.enableDirtyTracking();

    const e = server.createEntity();
    server.addComponent(e, Transform);

    const client = new World();
    client.applyDelta(server.getDelta());
    expect(client.isAlive(e)).toBe(true);

    server.destroyEntity(e);
    client.applyDelta(server.getDelta());
    expect(client.isAlive(e)).toBe(false);
  });

  it("component change on server reflected on client", () => {
    const server = new World();
    server.enableDirtyTracking();

    const e = server.createEntity();
    const h = server.addComponent(e, Health, { hp: 100 });

    const client = new World();
    client.applyDelta(server.getDelta());

    // Change on server
    h.hp = 50;
    server.markDirty(e, Health);
    client.applyDelta(server.getDelta());

    expect(client.getComponent(e, Health)!.hp).toBe(50);
  });

  it("reconnection: client applies snapshot, then continues with deltas", () => {
    const server = new World();
    server.enableDirtyTracking();
    server.addSystem("Movement", movementSystem, 1);

    const e = server.createEntity();
    server.addComponent(e, Transform, { localX: 0, localZ: 0 });
    server.addComponent(e, Velocity, { dx: 10, dz: 0 });

    // Run several ticks on server
    for (let i = 0; i < 10; i++) {
      server.tick(1);
      server.getDelta(); // consume deltas
    }

    // "New client" connects and gets snapshot
    const snapshot = server.captureSnapshot();
    const client = new World();
    client.applySnapshot(snapshot);

    // Verify initial state matches
    expect(client.getComponent(e, Transform)!.localX).toBe(
      server.getComponent(e, Transform)!.localX,
    );

    // Continue with deltas
    server.tick(1);
    const delta = server.getDelta();
    client.applyDelta(delta);

    expect(client.getComponent(e, Transform)!.localX).toBe(
      server.getComponent(e, Transform)!.localX,
    );
  });

  it("world.getDelta() convenience encodes and flushes", () => {
    const world = new World();
    world.enableDirtyTracking();

    const e = world.createEntity();
    world.addComponent(e, Transform, { localX: 5 });

    const delta1 = world.getDelta();
    expect(delta1.created).toHaveLength(1);
    expect(delta1.components).toHaveLength(1);

    // Second getDelta should be empty (flushed)
    const delta2 = world.getDelta();
    expect(delta2.created).toHaveLength(0);
    expect(delta2.components).toHaveLength(0);
  });

  it("world.captureSnapshot() convenience method works", () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, Transform, { localX: 99 });

    const snapshot = world.captureSnapshot();
    expect(snapshot.entities).toHaveLength(1);
    expect(snapshot.entities[0].id).toBe(e);
  });

  it("world.applySnapshot() convenience method works", () => {
    const serverWorld = new World();
    const e = serverWorld.createEntity();
    serverWorld.addComponent(e, Transform, { localX: 77 });

    const snapshot = serverWorld.captureSnapshot();

    const clientWorld = new World();
    clientWorld.applySnapshot(snapshot);

    expect(clientWorld.isAlive(e)).toBe(true);
    expect(clientWorld.getComponent(e, Transform)!.localX).toBe(77);
  });

  it("dirty tracking auto-marks on addComponent", () => {
    const world = new World();
    world.enableDirtyTracking();

    const e = world.createEntity();
    world.addComponent(e, Transform, { localX: 1 });

    const tracker = world.getDirtyTracker()!;
    const entries = tracker.getDirtyEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].componentType).toBe(Transform);
  });

  it("dirty tracking auto-marks on removeComponent", () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, Transform);

    // Enable tracking after setup
    world.enableDirtyTracking();
    world.removeComponent(e, Transform);

    const tracker = world.getDirtyTracker()!;
    const entries = tracker.getDirtyEntries();
    expect(entries).toHaveLength(1);
  });

  it("disableDirtyTracking stops tracking", () => {
    const world = new World();
    world.enableDirtyTracking();
    expect(world.getDirtyTracker()).not.toBeNull();

    world.disableDirtyTracking();
    expect(world.getDirtyTracker()).toBeNull();

    // Should not throw even without tracking
    const e = world.createEntity();
    world.addComponent(e, Transform);
    world.markDirty(e, Transform); // no-op when disabled
  });
});
