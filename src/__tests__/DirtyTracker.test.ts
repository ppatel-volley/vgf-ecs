import { describe, it, expect, beforeEach } from "vitest";
import { DirtyTracker } from "../networking/DirtyTracker.js";

class Position {
  x = 0;
  z = 0;
}

class Velocity {
  speed = 0;
}

class Health {
  hp = 100;
}

describe("DirtyTracker", () => {
  let tracker: DirtyTracker;

  beforeEach(() => {
    tracker = new DirtyTracker();
  });

  it("markDirty tracks entity + component type", () => {
    tracker.markDirty(1, Position);
    const entries = tracker.getDirtyEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].entityId).toBe(1);
    expect(entries[0].componentType).toBe(Position);
  });

  it("flush clears all entries", () => {
    tracker.markDirty(1, Position);
    tracker.markCreated(2);
    tracker.markDestroyed(3);
    tracker.flush();

    expect(tracker.getDirtyEntries()).toHaveLength(0);
    expect(tracker.getCreatedEntities()).toHaveLength(0);
    expect(tracker.getDestroyedEntities()).toHaveLength(0);
  });

  it("markCreated / markDestroyed tracked separately", () => {
    tracker.markCreated(10);
    tracker.markCreated(11);
    tracker.markDestroyed(5);

    expect(tracker.getCreatedEntities()).toEqual([10, 11]);
    expect(tracker.getDestroyedEntities()).toEqual([5]);
    expect(tracker.getDirtyEntries()).toHaveLength(0);
  });

  it("multiple marks for same entity+component coalesce", () => {
    tracker.markDirty(1, Position);
    tracker.markDirty(1, Position);
    tracker.markDirty(1, Position);

    expect(tracker.getDirtyEntries()).toHaveLength(1);
  });

  it("different components on same entity tracked separately", () => {
    tracker.markDirty(1, Position);
    tracker.markDirty(1, Velocity);

    expect(tracker.getDirtyEntries()).toHaveLength(2);
  });

  it("same component on different entities tracked separately", () => {
    tracker.markDirty(1, Position);
    tracker.markDirty(2, Position);

    expect(tracker.getDirtyEntries()).toHaveLength(2);
  });

  it("getDirtyEntries returns correct entries", () => {
    tracker.markDirty(1, Position);
    tracker.markDirty(2, Velocity);
    tracker.markDirty(3, Health);

    const entries = tracker.getDirtyEntries();
    expect(entries).toHaveLength(3);

    const types = entries.map((e) => e.componentType);
    expect(types).toContain(Position);
    expect(types).toContain(Velocity);
    expect(types).toContain(Health);
  });

  it("returns copies from getDirtyEntries (not internal refs)", () => {
    tracker.markDirty(1, Position);
    const entries1 = tracker.getDirtyEntries();
    entries1.length = 0; // mutate the returned array
    expect(tracker.getDirtyEntries()).toHaveLength(1); // internal still intact
  });

  it("returns copies from getCreatedEntities", () => {
    tracker.markCreated(1);
    const created = tracker.getCreatedEntities();
    created.length = 0;
    expect(tracker.getCreatedEntities()).toHaveLength(1);
  });

  it("flush then mark again works", () => {
    tracker.markDirty(1, Position);
    tracker.flush();
    tracker.markDirty(2, Velocity);

    expect(tracker.getDirtyEntries()).toHaveLength(1);
    expect(tracker.getDirtyEntries()[0].entityId).toBe(2);
  });
});
