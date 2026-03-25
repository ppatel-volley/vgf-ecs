import { describe, it, expect } from "vitest";
import { World } from "../core/World.js";
import type { EntityId } from "../core/Entity.js";

// ── Components for mini movement system ──
class Transform {
  x = 0;
  y = 0;
}

class Velocity {
  vx = 0;
  vy = 0;
}

class Health {
  hp = 100;
}

class Collider {
  radius = 10;
}

class Dead {
  since = 0;
}

describe("Integration — mini movement system", () => {
  function movementSystem(world: World, dt: number): void {
    world.each(Transform, Velocity, (_eid, t, v) => {
      t.x += v.vx * dt;
      t.y += v.vy * dt;
    });
  }

  it("tick updates position based on velocity", () => {
    const w = new World();
    const eid = w.createEntity();
    w.addComponent(eid, Transform, { x: 0, y: 0 });
    w.addComponent(eid, Velocity, { vx: 10, vy: 5 });

    w.addSystem("movement", movementSystem);
    w.tick(1.0); // 1 second

    const t = w.getComponent(eid, Transform)!;
    expect(t.x).toBeCloseTo(10);
    expect(t.y).toBeCloseTo(5);
  });

  it("multiple ticks accumulate correctly", () => {
    const w = new World();
    const eid = w.createEntity();
    w.addComponent(eid, Transform, { x: 0, y: 0 });
    w.addComponent(eid, Velocity, { vx: 60, vy: 0 });

    w.addSystem("movement", movementSystem);

    for (let i = 0; i < 60; i++) {
      w.tick(1 / 60);
    }

    const t = w.getComponent(eid, Transform)!;
    expect(t.x).toBeCloseTo(60, 0);
    expect(w.tickCount).toBe(60);
  });
});

describe("Integration — collision detection", () => {
  function distance(ax: number, ay: number, bx: number, by: number): number {
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  }

  it("detects two entities within collision distance", () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();

    w.addComponent(a, Transform, { x: 0, y: 0 });
    w.addComponent(a, Collider, { radius: 10 });
    w.addComponent(b, Transform, { x: 15, y: 0 });
    w.addComponent(b, Collider, { radius: 10 });

    const collisions: [EntityId, EntityId][] = [];

    w.addSystem("collision", (world) => {
      const entities = world.query(Transform, Collider).execute();
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const ta = world.getComponent(entities[i], Transform)!;
          const ca = world.getComponent(entities[i], Collider)!;
          const tb = world.getComponent(entities[j], Transform)!;
          const cb = world.getComponent(entities[j], Collider)!;

          if (distance(ta.x, ta.y, tb.x, tb.y) < ca.radius + cb.radius) {
            collisions.push([entities[i], entities[j]]);
          }
        }
      }
    });

    w.tick(1 / 60);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toContain(a);
    expect(collisions[0]).toContain(b);
  });

  it("does not detect non-overlapping entities", () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();

    w.addComponent(a, Transform, { x: 0, y: 0 });
    w.addComponent(a, Collider, { radius: 5 });
    w.addComponent(b, Transform, { x: 100, y: 0 });
    w.addComponent(b, Collider, { radius: 5 });

    let collisionCount = 0;

    w.addSystem("collision", (world) => {
      const entities = world.query(Transform, Collider).execute();
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const ta = world.getComponent(entities[i], Transform)!;
          const ca = world.getComponent(entities[i], Collider)!;
          const tb = world.getComponent(entities[j], Transform)!;
          const cb = world.getComponent(entities[j], Collider)!;

          if (distance(ta.x, ta.y, tb.x, tb.y) < ca.radius + cb.radius) {
            collisionCount++;
          }
        }
      }
    });

    w.tick(1 / 60);
    expect(collisionCount).toBe(0);
  });
});

describe("Integration — parent-child movement", () => {
  it("child Transform offset relative to parent", () => {
    const w = new World();
    const parent = w.createEntity();
    const child = w.createEntity(parent);

    w.addComponent(parent, Transform, { x: 100, y: 50 });
    w.addComponent(parent, Velocity, { vx: 10, vy: 0 });
    w.addComponent(child, Transform, { x: 5, y: 5 }); // Local offset

    // System: move parent, then update child position = parent + local offset.
    w.addSystem(
      "movement",
      (world, dt) => {
        world.each(Transform, Velocity, (_eid, t, v) => {
          t.x += v.vx * dt;
          t.y += v.vy * dt;
        });
      },
      10,
    );

    w.addSystem(
      "hierarchy",
      (world) => {
        // Simple hierarchy: child's world position = parent position + child local offset.
        const entities = world.query(Transform).execute();
        for (const eid of entities) {
          const parentId = world.getParent(eid);
          if (parentId === null) continue;
          const parentT = world.getComponent(parentId, Transform);
          if (!parentT) continue;
          const childT = world.getComponent(eid, Transform)!;
          // Store the local offset and apply parent position.
          // (In a real system, we'd separate local/world coords.)
          childT.x = parentT.x + 5;
          childT.y = parentT.y + 5;
        }
      },
      20,
    );

    w.tick(1.0);

    const pt = w.getComponent(parent, Transform)!;
    expect(pt.x).toBeCloseTo(110);

    const ct = w.getComponent(child, Transform)!;
    expect(ct.x).toBeCloseTo(115);
    expect(ct.y).toBeCloseTo(55);
  });
});

describe("Integration — 100-entity benchmark", () => {
  it("tick completes in reasonable time with 100 entities and 5 systems", () => {
    const w = new World();

    // Create 100 entities with Transform + Velocity.
    for (let i = 0; i < 100; i++) {
      const eid = w.createEntity();
      w.addComponent(eid, Transform, { x: i * 10, y: i * 5 });
      w.addComponent(eid, Velocity, { vx: 1, vy: 0.5 });
      w.addComponent(eid, Health, { hp: 100 });
    }

    // Register 5 systems.
    w.addSystem(
      "movement",
      (world, dt) => {
        world.each(Transform, Velocity, (_eid, t, v) => {
          t.x += v.vx * dt;
          t.y += v.vy * dt;
        });
      },
      10,
    );

    w.addSystem(
      "health-check",
      (world) => {
        world.each(Health, (_eid, h) => {
          if (h.hp <= 0) {
            /* would destroy */
          }
        });
      },
      20,
    );

    w.addSystem(
      "collision",
      (world) => {
        const _entities = world.query(Transform, Collider).execute();
        // No colliders in this test — just exercises the query.
      },
      30,
    );

    w.addSystem(
      "cleanup",
      () => {
        // Noop system for ordering test.
      },
      40,
    );

    w.addSystem(
      "stats",
      (world) => {
        const _count = world.query(Transform).execute().length;
      },
      50,
    );

    // Run 60 ticks and verify performance.
    const start = Date.now();
    for (let i = 0; i < 60; i++) {
      w.tick(1 / 60);
    }
    const elapsed = Date.now() - start;

    // Each tick should be well under 5ms. Total for 60 ticks should be <300ms.
    expect(elapsed).toBeLessThan(300);
    expect(w.tickCount).toBe(60);

    // Verify position was updated.
    const entities = w.query(Transform).execute();
    expect(entities).toHaveLength(100);
    const first = w.getComponent(entities[0], Transform)!;
    expect(first.x).toBeGreaterThan(0);
  });

  it("entity creation performance: 1000 entities under 50ms", () => {
    const w = new World();
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      const eid = w.createEntity();
      w.addComponent(eid, Transform, { x: i, y: i });
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
    expect(w.entityCount).toBe(1000);
  });
});

describe("Integration — multi-system interaction", () => {
  it("damage system reduces health, death system marks dead", () => {
    const w = new World();
    const eid = w.createEntity();
    w.addComponent(eid, Health, { hp: 10 });

    // Damage system: apply 5 damage per tick.
    w.addSystem(
      "damage",
      (world) => {
        world.each(Health, (_eid, h) => {
          h.hp -= 5;
        });
      },
      10,
    );

    // Death system: if hp <= 0, add Dead marker.
    w.addSystem(
      "death",
      (world) => {
        world.each(Health, (eid, h) => {
          if (h.hp <= 0 && !world.hasComponent(eid, Dead)) {
            world.addComponent(eid, Dead, { since: world.tickCount });
          }
        });
      },
      20,
    );

    w.tick(1 / 60); // HP: 10 → 5
    expect(w.getComponent(eid, Health)!.hp).toBe(5);
    expect(w.hasComponent(eid, Dead)).toBe(false);

    w.tick(1 / 60); // HP: 5 → 0
    expect(w.getComponent(eid, Health)!.hp).toBe(0);
    // Dead is deferred, but flushed after the "death" system.
    expect(w.hasComponent(eid, Dead)).toBe(true);
  });
});

describe("Integration — command-driven gameplay", () => {
  it("fire command triggers damage via command queue", () => {
    const w = new World();
    const attacker = w.createEntity();
    const target = w.createEntity();
    w.addComponent(target, Health, { hp: 100 });

    // Command handler system.
    w.addSystem("combat-cmd", (world) => {
      for (const cmd of world.getCommands("fire")) {
        const targetId = cmd.targetId as EntityId;
        const hp = world.getComponent(targetId, Health);
        if (hp) {
          hp.hp -= 25;
        }
      }
    });

    w.enqueueCommand({ type: "fire", attackerId: attacker, targetId: target });
    w.tick(1 / 60);

    expect(w.getComponent(target, Health)!.hp).toBe(75);

    // Commands cleared after tick.
    w.tick(1 / 60);
    expect(w.getComponent(target, Health)!.hp).toBe(75); // No more damage.
  });
});
