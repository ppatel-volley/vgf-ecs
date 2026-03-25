import { describe, it, expect } from "vitest";
import { World } from "../core/World.js";

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

class Anchored {
  since = 0;
}

describe("Query — basic", () => {
  it("queries entities with a single component", () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();
    w.addComponent(a, Position);
    w.addComponent(b, Position);

    const result = w.query(Position).execute();
    expect(result).toHaveLength(2);
    expect(result).toContain(a);
    expect(result).toContain(b);
  });

  it("queries entities with multiple components (intersection)", () => {
    const w = new World();
    const mover = w.createEntity();
    const stationary = w.createEntity();
    w.addComponent(mover, Position);
    w.addComponent(mover, Velocity);
    w.addComponent(stationary, Position);

    const result = w.query(Position, Velocity).execute();
    expect(result).toHaveLength(1);
    expect(result).toContain(mover);
  });

  it("returns empty array when no entities match", () => {
    const w = new World();
    w.createEntity();
    const result = w.query(Position).execute();
    expect(result).toEqual([]);
  });

  it("returns empty array for empty world", () => {
    const w = new World();
    expect(w.query(Position).execute()).toEqual([]);
  });
});

describe("Query — without (exclusion)", () => {
  it("excludes entities with a specified component", () => {
    const w = new World();
    const mover = w.createEntity();
    const anchored = w.createEntity();

    w.addComponent(mover, Position);
    w.addComponent(mover, Velocity);
    w.addComponent(anchored, Position);
    w.addComponent(anchored, Velocity);
    w.addComponent(anchored, Anchored);

    const result = w.query(Position, Velocity).without(Anchored).execute();
    expect(result).toHaveLength(1);
    expect(result).toContain(mover);
  });

  it("without with no matching exclusions returns all", () => {
    const w = new World();
    const a = w.createEntity();
    w.addComponent(a, Position);

    const result = w.query(Position).without(Anchored).execute();
    expect(result).toHaveLength(1);
  });
});

describe("Query — cache", () => {
  it("returns cached results on repeated query", () => {
    const w = new World();
    const a = w.createEntity();
    w.addComponent(a, Position);

    const r1 = w.query(Position).execute();
    const r2 = w.query(Position).execute();
    // Same array reference = cache hit.
    expect(r1).toBe(r2);
  });

  it("invalidates cache on component add", () => {
    const w = new World();
    const a = w.createEntity();
    w.addComponent(a, Position);

    const r1 = w.query(Position).execute();
    expect(r1).toHaveLength(1);

    const b = w.createEntity();
    w.addComponent(b, Position);

    const r2 = w.query(Position).execute();
    expect(r2).toHaveLength(2);
    expect(r2).not.toBe(r1);
  });

  it("invalidates cache on component remove", () => {
    const w = new World();
    const a = w.createEntity();
    w.addComponent(a, Position);
    w.addComponent(a, Velocity);

    const r1 = w.query(Position, Velocity).execute();
    expect(r1).toHaveLength(1);

    w.removeComponent(a, Velocity);

    const r2 = w.query(Position, Velocity).execute();
    expect(r2).toHaveLength(0);
  });

  it("invalidates cache on entity destroy", () => {
    const w = new World();
    const a = w.createEntity();
    w.addComponent(a, Position);

    const r1 = w.query(Position).execute();
    expect(r1).toHaveLength(1);

    w.destroyEntity(a);

    const r2 = w.query(Position).execute();
    expect(r2).toHaveLength(0);
  });

  it("invalidates cache on entity create", () => {
    const w = new World();

    const r1 = w.query(Position).execute();
    expect(r1).toHaveLength(0);

    const a = w.createEntity();
    w.addComponent(a, Position);

    const r2 = w.query(Position).execute();
    expect(r2).toHaveLength(1);
  });
});

describe("world.each() — ergonomic callback", () => {
  it("iterates with single component", () => {
    const w = new World();
    const a = w.createEntity();
    w.addComponent(a, Position, { x: 10, y: 20 });

    const collected: { x: number; y: number }[] = [];
    w.each(Position, (_eid, pos) => {
      collected.push({ x: pos.x, y: pos.y });
    });

    expect(collected).toEqual([{ x: 10, y: 20 }]);
  });

  it("iterates with two components", () => {
    const w = new World();
    const a = w.createEntity();
    w.addComponent(a, Position, { x: 1, y: 2 });
    w.addComponent(a, Velocity, { dx: 3, dy: 4 });

    w.each(Position, Velocity, (_eid, pos, vel) => {
      expect(pos.x).toBe(1);
      expect(vel.dx).toBe(3);
    });
  });

  it("skips entities missing required components", () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();
    w.addComponent(a, Position);
    w.addComponent(b, Position);
    w.addComponent(b, Velocity);

    let count = 0;
    w.each(Position, Velocity, () => {
      count++;
    });
    expect(count).toBe(1);
  });

  it("provides correct entity ID", () => {
    const w = new World();
    const a = w.createEntity();
    w.addComponent(a, Position);

    w.each(Position, (eid) => {
      expect(eid).toBe(a);
    });
  });
});

describe("world.queryWith() — typed tuples", () => {
  it("returns [eid, componentA] tuples", () => {
    const w = new World();
    const a = w.createEntity();
    w.addComponent(a, Position, { x: 5, y: 10 });

    const results = [...w.queryWith(Position)];
    expect(results).toHaveLength(1);
    const [eid, pos] = results[0];
    expect(eid).toBe(a);
    expect(pos.x).toBe(5);
  });

  it("returns [eid, A, B] tuples for two components", () => {
    const w = new World();
    const a = w.createEntity();
    w.addComponent(a, Position, { x: 1, y: 2 });
    w.addComponent(a, Velocity, { dx: 3, dy: 4 });

    for (const [eid, pos, vel] of w.queryWith(Position, Velocity)) {
      expect(eid).toBe(a);
      expect(pos.x).toBe(1);
      expect(vel.dx).toBe(3);
    }
  });

  it("returns empty iterable for no matches", () => {
    const w = new World();
    const results = [...w.queryWith(Position)];
    expect(results).toHaveLength(0);
  });
});
