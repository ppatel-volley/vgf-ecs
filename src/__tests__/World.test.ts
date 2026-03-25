import { describe, it, expect } from "vitest";
import { World } from "../core/World.js";
import { entityIndex, entityGeneration, type EntityId } from "../core/Entity.js";

// ── Test components ──
class Position {
  x = 0;
  y = 0;
}

class Velocity {
  dx = 0;
  dy = 0;
}

class Health {
  hp = 100;
}

class Tag {
  label = "";
}

describe("World — Entity lifecycle", () => {
  it("creates an entity", () => {
    const w = new World();
    const eid = w.createEntity();
    expect(w.isAlive(eid)).toBe(true);
    expect(w.entityCount).toBe(1);
  });

  it("creates multiple entities with unique IDs", () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();
    expect(a).not.toBe(b);
    expect(w.entityCount).toBe(2);
  });

  it("destroys an entity", () => {
    const w = new World();
    const eid = w.createEntity();
    w.destroyEntity(eid);
    expect(w.isAlive(eid)).toBe(false);
    expect(w.entityCount).toBe(0);
  });

  it("destroying a dead entity is a no-op", () => {
    const w = new World();
    const eid = w.createEntity();
    w.destroyEntity(eid);
    w.destroyEntity(eid); // Should not throw.
    expect(w.entityCount).toBe(0);
  });

  it("recycled entity has incremented generation", () => {
    const w = new World();
    const e1 = w.createEntity();
    const idx = entityIndex(e1);
    w.destroyEntity(e1);
    const e2 = w.createEntity();
    expect(entityIndex(e2)).toBe(idx);
    expect(entityGeneration(e2)).toBe(1);
  });
});

describe("World — Component CRUD", () => {
  it("adds a component to an entity", () => {
    const w = new World();
    const eid = w.createEntity();
    const pos = w.addComponent(eid, Position, { x: 10, y: 20 });
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(20);
  });

  it("gets a component", () => {
    const w = new World();
    const eid = w.createEntity();
    w.addComponent(eid, Position, { x: 5, y: 15 });
    const got = w.getComponent(eid, Position);
    expect(got).not.toBeNull();
    expect(got!.x).toBe(5);
  });

  it("returns null for missing component", () => {
    const w = new World();
    const eid = w.createEntity();
    expect(w.getComponent(eid, Position)).toBeNull();
  });

  it("hasComponent returns true/false correctly", () => {
    const w = new World();
    const eid = w.createEntity();
    expect(w.hasComponent(eid, Position)).toBe(false);
    w.addComponent(eid, Position);
    expect(w.hasComponent(eid, Position)).toBe(true);
  });

  it("removes a component", () => {
    const w = new World();
    const eid = w.createEntity();
    w.addComponent(eid, Position);
    w.removeComponent(eid, Position);
    expect(w.hasComponent(eid, Position)).toBe(false);
  });

  it("removing a nonexistent component is a no-op", () => {
    const w = new World();
    const eid = w.createEntity();
    w.removeComponent(eid, Position); // Should not throw.
    expect(w.hasComponent(eid, Position)).toBe(false);
  });

  it("destroy entity removes all components", () => {
    const w = new World();
    const eid = w.createEntity();
    w.addComponent(eid, Position, { x: 1, y: 2 });
    w.addComponent(eid, Velocity, { dx: 3, dy: 4 });
    w.destroyEntity(eid);

    // After destroy, even if index is reused, old components are gone.
    const e2 = w.createEntity();
    expect(w.hasComponent(e2, Position)).toBe(false);
    expect(w.hasComponent(e2, Velocity)).toBe(false);
  });

  it("component data is mutable by reference", () => {
    const w = new World();
    const eid = w.createEntity();
    const pos = w.addComponent(eid, Position, { x: 0, y: 0 });
    pos.x = 42;
    expect(w.getComponent(eid, Position)!.x).toBe(42);
  });

  it("multiple entities have independent components", () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();
    w.addComponent(a, Position, { x: 1, y: 1 });
    w.addComponent(b, Position, { x: 2, y: 2 });
    expect(w.getComponent(a, Position)!.x).toBe(1);
    expect(w.getComponent(b, Position)!.x).toBe(2);
  });
});

describe("World — Parent-child hierarchy", () => {
  it("creates a child entity", () => {
    const w = new World();
    const parent = w.createEntity();
    const child = w.createEntity(parent);
    expect(w.getParent(child)).toBe(parent);
    expect(w.getChildren(parent)).toContain(child);
  });

  it("reparents an entity", () => {
    const w = new World();
    const oldParent = w.createEntity();
    const newParent = w.createEntity();
    const child = w.createEntity(oldParent);

    w.setParent(child, newParent);
    expect(w.getParent(child)).toBe(newParent);
    expect(w.getChildren(oldParent)).not.toContain(child);
    expect(w.getChildren(newParent)).toContain(child);
  });

  it("removes parent (detach)", () => {
    const w = new World();
    const parent = w.createEntity();
    const child = w.createEntity(parent);

    w.removeParent(child);
    expect(w.getParent(child)).toBeNull();
    expect(w.getChildren(parent)).not.toContain(child);
  });

  it("destroying parent cascades to children", () => {
    const w = new World();
    const parent = w.createEntity();
    const child = w.createEntity(parent);
    const grandchild = w.createEntity(child);

    w.destroyEntity(parent);
    expect(w.isAlive(parent)).toBe(false);
    expect(w.isAlive(child)).toBe(false);
    expect(w.isAlive(grandchild)).toBe(false);
    expect(w.entityCount).toBe(0);
  });

  it("destroying child does not affect parent", () => {
    const w = new World();
    const parent = w.createEntity();
    const child = w.createEntity(parent);

    w.destroyEntity(child);
    expect(w.isAlive(parent)).toBe(true);
    expect(w.getChildren(parent)).not.toContain(child);
  });

  it("getChildren returns empty array for childless entity", () => {
    const w = new World();
    const eid = w.createEntity();
    expect(w.getChildren(eid)).toEqual([]);
  });

  it("getParent returns null for root entity", () => {
    const w = new World();
    const eid = w.createEntity();
    expect(w.getParent(eid)).toBeNull();
  });
});

describe("World — Singletons", () => {
  class GameConfig {
    arenaRadius = 500;
    maxPlayers = 4;
  }

  class GamePhase {
    phase = "lobby";
  }

  it("sets and gets a singleton", () => {
    const w = new World();
    w.setSingleton(GameConfig, { arenaRadius: 1000 });
    const cfg = w.getSingleton(GameConfig);
    expect(cfg).not.toBeNull();
    expect(cfg!.arenaRadius).toBe(1000);
    expect(cfg!.maxPlayers).toBe(4); // Default value.
  });

  it("returns null for missing singleton", () => {
    const w = new World();
    expect(w.getSingleton(GameConfig)).toBeNull();
  });

  it("removes a singleton", () => {
    const w = new World();
    w.setSingleton(GameConfig);
    w.removeSingleton(GameConfig);
    expect(w.getSingleton(GameConfig)).toBeNull();
  });

  it("overwrites singleton on re-set", () => {
    const w = new World();
    w.setSingleton(GamePhase, { phase: "combat" });
    w.setSingleton(GamePhase, { phase: "victory" });
    expect(w.getSingleton(GamePhase)!.phase).toBe("victory");
  });
});

describe("World — Time tracking", () => {
  it("time and tickCount start at zero", () => {
    const w = new World();
    expect(w.time).toBe(0);
    expect(w.tickCount).toBe(0);
  });

  it("tick advances time and tickCount", () => {
    const w = new World();
    w.tick(1 / 60);
    expect(w.tickCount).toBe(1);
    expect(w.time).toBeCloseTo(1 / 60);

    w.tick(1 / 60);
    expect(w.tickCount).toBe(2);
    expect(w.time).toBeCloseTo(2 / 60);
  });
});

describe("World — Session isolation", () => {
  it("multiple worlds are independent", () => {
    const w1 = new World({ sessionId: "session-1" });
    const w2 = new World({ sessionId: "session-2" });

    const e1 = w1.createEntity();
    w1.addComponent(e1, Position, { x: 10, y: 10 });

    const e2 = w2.createEntity();
    w2.addComponent(e2, Position, { x: 99, y: 99 });

    // w1's entity should not be visible in w2.
    expect(w1.getComponent(e1, Position)!.x).toBe(10);
    expect(w2.getComponent(e2, Position)!.x).toBe(99);
    expect(w1.entityCount).toBe(1);
    expect(w2.entityCount).toBe(1);
  });

  it("destroying entity in one world does not affect another", () => {
    const w1 = new World();
    const w2 = new World();
    const e1 = w1.createEntity();
    const e2 = w2.createEntity();

    w1.destroyEntity(e1);
    expect(w1.entityCount).toBe(0);
    expect(w2.isAlive(e2)).toBe(true);
    expect(w2.entityCount).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════
//  Bug regression tests
// ══════════════════════════════════════════════════════════

describe("World — Bug 1: Stale entity ID validation", () => {
  it("addComponent on stale ID throws", () => {
    const w = new World();
    const e1 = w.createEntity();
    const staleId = e1;
    w.destroyEntity(e1);

    // Index gets recycled, but staleId has old generation.
    const e2 = w.createEntity();
    expect(entityIndex(e2)).toBe(entityIndex(staleId));

    expect(() => w.addComponent(staleId, Position, { x: 99, y: 99 })).toThrow(
      /not alive/,
    );
  });

  it("getComponent on stale ID returns null (does not read new entity's data)", () => {
    const w = new World();
    const e1 = w.createEntity();
    w.addComponent(e1, Position, { x: 1, y: 2 });
    const staleId = e1;
    w.destroyEntity(e1);

    const e2 = w.createEntity();
    w.addComponent(e2, Position, { x: 42, y: 42 });

    // staleId should NOT see e2's Position.
    expect(w.getComponent(staleId, Position)).toBeNull();
  });

  it("hasComponent on stale ID returns false", () => {
    const w = new World();
    const e1 = w.createEntity();
    w.addComponent(e1, Position);
    const staleId = e1;
    w.destroyEntity(e1);

    const e2 = w.createEntity();
    w.addComponent(e2, Position);

    expect(w.hasComponent(staleId, Position)).toBe(false);
  });

  it("removeComponent on stale ID throws", () => {
    const w = new World();
    const e1 = w.createEntity();
    w.addComponent(e1, Position);
    const staleId = e1;
    w.destroyEntity(e1);

    const e2 = w.createEntity();
    w.addComponent(e2, Position);

    expect(() => w.removeComponent(staleId, Position)).toThrow(/not alive/);
  });

  it("setParent on stale ID throws", () => {
    const w = new World();
    const e1 = w.createEntity();
    const staleId = e1;
    w.destroyEntity(e1);
    const e2 = w.createEntity();

    expect(() => w.setParent(staleId, e2)).toThrow(/not alive/);
  });

  it("removeParent on stale ID throws", () => {
    const w = new World();
    const e1 = w.createEntity();
    const staleId = e1;
    w.destroyEntity(e1);
    w.createEntity(); // recycle

    expect(() => w.removeParent(staleId)).toThrow(/not alive/);
  });

  it("getParent on stale ID returns null", () => {
    const w = new World();
    const parent = w.createEntity();
    const child = w.createEntity(parent);
    const staleChild = child;
    w.destroyEntity(child);
    w.createEntity(); // recycle

    expect(w.getParent(staleChild)).toBeNull();
  });

  it("getChildren on stale ID returns empty array", () => {
    const w = new World();
    const parent = w.createEntity();
    w.createEntity(parent);
    const staleParent = parent;
    w.destroyEntity(parent);
    w.createEntity(); // recycle

    expect(w.getChildren(staleParent)).toEqual([]);
  });
});

describe("World — Bug 2: createEntity inside system returns real ID", () => {
  it("system creates entity + adds component, entity has component after tick", () => {
    const w = new World();
    let createdId: EntityId | null = null;

    w.addSystem("spawner", (world) => {
      const eid = world.createEntity();
      // createEntity should return a real ID, not NULL_ENTITY.
      expect(eid).not.toBe(-1);
      world.addComponent(eid, Position, { x: 7, y: 13 });
      createdId = eid;
    });

    w.tick(1 / 60);

    expect(createdId).not.toBeNull();
    expect(w.isAlive(createdId!)).toBe(true);
    expect(w.hasComponent(createdId!, Position)).toBe(true);
    expect(w.getComponent(createdId!, Position)!.x).toBe(7);
    expect(w.getComponent(createdId!, Position)!.y).toBe(13);
  });
});

describe("World — Bug 3: Cycle detection in hierarchy", () => {
  it("setParent(e, e) throws (self-parent)", () => {
    const w = new World();
    const e = w.createEntity();

    expect(() => w.setParent(e, e)).toThrow(/Cannot parent entity to itself/);
  });

  it("ancestor cycle e1→e2→e1 throws on the second setParent", () => {
    const w = new World();
    const e1 = w.createEntity();
    const e2 = w.createEntity();

    w.setParent(e2, e1); // e1 is parent of e2
    expect(() => w.setParent(e1, e2)).toThrow(/Cycle detected/);
  });

  it("deeper ancestor cycle is detected", () => {
    const w = new World();
    const e1 = w.createEntity();
    const e2 = w.createEntity();
    const e3 = w.createEntity();

    w.setParent(e2, e1); // e1 → e2
    w.setParent(e3, e2); // e1 → e2 → e3
    expect(() => w.setParent(e1, e3)).toThrow(/Cycle detected/);
  });
});

describe("World — Bug 4: getChildren returns defensive copy", () => {
  it("mutating returned array does not affect internal state", () => {
    const w = new World();
    const parent = w.createEntity();
    const child = w.createEntity(parent);

    const children = w.getChildren(parent);
    expect(children).toContain(child);

    // Mutate the returned array.
    children.length = 0;

    // Internal state should be unchanged.
    const childrenAgain = w.getChildren(parent);
    expect(childrenAgain).toContain(child);
    expect(childrenAgain.length).toBe(1);
  });

  it("pushing to returned array does not add phantom children", () => {
    const w = new World();
    const parent = w.createEntity();
    const child = w.createEntity(parent);
    const unrelated = w.createEntity();

    const children = w.getChildren(parent);
    children.push(unrelated);

    const childrenAgain = w.getChildren(parent);
    expect(childrenAgain).toEqual([child]);
  });
});
