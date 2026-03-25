import { describe, it, expect } from "vitest";
import { World } from "../core/World.js";
import type { EntityId } from "../core/Entity.js";

// ── Test components ──
class Position {
  x = 0;
  y = 0;
}

class Velocity {
  dx = 0;
  dy = 0;
}

class Marker {
  value = "";
}

describe("System — priority ordering", () => {
  it("runs systems in priority order", () => {
    const w = new World();
    const order: string[] = [];

    w.addSystem("C", () => order.push("C"), 30);
    w.addSystem("A", () => order.push("A"), 10);
    w.addSystem("B", () => order.push("B"), 20);

    w.tick(1 / 60);
    expect(order).toEqual(["A", "B", "C"]);
  });

  it("same priority preserves registration order", () => {
    const w = new World();
    const order: string[] = [];

    w.addSystem("first", () => order.push("first"), 0);
    w.addSystem("second", () => order.push("second"), 0);
    w.addSystem("third", () => order.push("third"), 0);

    w.tick(1 / 60);
    expect(order).toEqual(["first", "second", "third"]);
  });

  it("system receives world and dt", () => {
    const w = new World();
    let receivedDt = 0;
    let receivedWorld: World | null = null;

    w.addSystem("test", (world, dt) => {
      receivedWorld = world;
      receivedDt = dt;
    });

    w.tick(0.016);
    expect(receivedWorld).toBe(w);
    expect(receivedDt).toBeCloseTo(0.016);
  });
});

describe("System — deferred operations", () => {
  it("deferred entity creation flushes between systems", () => {
    const w = new World();
    let createdEntity: EntityId | null = null;

    // System A creates an entity (deferred).
    w.addSystem(
      "creator",
      (world) => {
        world.createEntity();
      },
      10,
    );

    // System B should see the entity created by System A.
    w.addSystem(
      "reader",
      (world) => {
        createdEntity = world.entityCount > 0 ? "found" as any : null;
      },
      20,
    );

    w.tick(1 / 60);
    expect(w.entityCount).toBe(1);
    expect(createdEntity).not.toBeNull();
  });

  it("deferred component add flushes between systems", () => {
    const w = new World();
    const eid = w.createEntity();
    let foundComponent = false;

    w.addSystem(
      "adder",
      (world) => {
        world.addComponent(eid, Position, { x: 42, y: 0 });
      },
      10,
    );

    w.addSystem(
      "checker",
      (world) => {
        const pos = world.getComponent(eid, Position);
        foundComponent = pos !== null && pos.x === 42;
      },
      20,
    );

    w.tick(1 / 60);
    expect(foundComponent).toBe(true);
  });

  it("deferred entity destroy flushes between systems", () => {
    const w = new World();
    const eid = w.createEntity();
    w.addComponent(eid, Position);

    let isAliveInReader = true;

    w.addSystem(
      "destroyer",
      (world) => {
        world.destroyEntity(eid);
      },
      10,
    );

    w.addSystem(
      "reader",
      (world) => {
        isAliveInReader = world.isAlive(eid);
      },
      20,
    );

    w.tick(1 / 60);
    expect(isAliveInReader).toBe(false);
  });

  it("deferred component remove flushes between systems", () => {
    const w = new World();
    const eid = w.createEntity();
    w.addComponent(eid, Position, { x: 1, y: 2 });

    let hasPos = true;

    w.addSystem(
      "remover",
      (world) => {
        world.removeComponent(eid, Position);
      },
      10,
    );

    w.addSystem(
      "checker",
      (world) => {
        hasPos = world.hasComponent(eid, Position);
      },
      20,
    );

    w.tick(1 / 60);
    expect(hasPos).toBe(false);
  });
});

describe("System — error handling", () => {
  it("one system throwing does not stop others", () => {
    const w = new World();
    const order: string[] = [];

    w.addSystem(
      "ok-first",
      () => {
        order.push("ok-first");
      },
      10,
    );

    w.addSystem(
      "broken",
      () => {
        order.push("broken");
        throw new Error("kaboom");
      },
      20,
    );

    w.addSystem(
      "ok-last",
      () => {
        order.push("ok-last");
      },
      30,
    );

    w.tick(1 / 60);
    expect(order).toEqual(["ok-first", "broken", "ok-last"]);
  });

  it("getTickErrors() returns errors from failed systems", () => {
    const w = new World();
    w.addSystem("broken", () => {
      throw new Error("test error");
    });

    w.tick(1 / 60);
    const errors = w.getTickErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].systemName).toBe("broken");
    expect(errors[0].tickCount).toBe(1);
    expect((errors[0].error as Error).message).toBe("test error");
  });

  it("tick errors are cleared each tick", () => {
    const w = new World();
    let shouldThrow = true;

    w.addSystem("maybe-broken", () => {
      if (shouldThrow) throw new Error("boom");
    });

    w.tick(1 / 60);
    expect(w.getTickErrors()).toHaveLength(1);

    shouldThrow = false;
    w.tick(1 / 60);
    expect(w.getTickErrors()).toHaveLength(0);
  });
});

describe("System — lifecycle hooks", () => {
  it("onComponentAdded fires when component is added", () => {
    const w = new World();
    const added: EntityId[] = [];
    w.onComponentAdded(Position, (eid) => added.push(eid));

    const eid = w.createEntity();
    w.addComponent(eid, Position);
    expect(added).toEqual([eid]);
  });

  it("onComponentRemoved fires when component is removed", () => {
    const w = new World();
    const removed: EntityId[] = [];
    w.onComponentRemoved(Position, (eid) => removed.push(eid));

    const eid = w.createEntity();
    w.addComponent(eid, Position);
    w.removeComponent(eid, Position);
    expect(removed).toEqual([eid]);
  });

  it("onComponentRemoved fires on entity destroy", () => {
    const w = new World();
    const removed: EntityId[] = [];
    w.onComponentRemoved(Position, (eid) => removed.push(eid));

    const eid = w.createEntity();
    w.addComponent(eid, Position);
    w.destroyEntity(eid);
    expect(removed).toEqual([eid]);
  });
});

describe("System — removeSystem", () => {
  it("removed system does not run", () => {
    const w = new World();
    const ran: string[] = [];

    w.addSystem("a", () => ran.push("a"), 10);
    w.addSystem("b", () => ran.push("b"), 20);

    w.removeSystem("a");
    w.tick(1 / 60);
    expect(ran).toEqual(["b"]);
  });
});

describe("System — CommandQueue integration", () => {
  it("commands enqueued before tick are available to systems", () => {
    const w = new World();
    const processed: string[] = [];

    w.addSystem("handler", (world) => {
      for (const cmd of world.getCommands("fire")) {
        processed.push(cmd.target as string);
      }
    });

    w.enqueueCommand({ type: "fire", target: "enemy1" });
    w.enqueueCommand({ type: "fire", target: "enemy2" });
    w.enqueueCommand({ type: "dock", port: "harbor" });

    w.tick(1 / 60);
    expect(processed).toEqual(["enemy1", "enemy2"]);
  });

  it("commands are cleared at end of tick", () => {
    const w = new World();
    w.addSystem("noop", () => {});

    w.enqueueCommand({ type: "test" });
    w.tick(1 / 60);
    expect(w.getCommands("test")).toHaveLength(0);
  });

  it("commands enqueued during tick are available in same tick", () => {
    const w = new World();
    const received: string[] = [];

    w.addSystem(
      "enqueuer",
      (world) => {
        world.enqueueCommand({ type: "spawned", name: "bullet" });
      },
      10,
    );

    w.addSystem(
      "consumer",
      (world) => {
        for (const cmd of world.getCommands("spawned")) {
          received.push(cmd.name as string);
        }
      },
      20,
    );

    w.tick(1 / 60);
    expect(received).toEqual(["bullet"]);
  });
});
