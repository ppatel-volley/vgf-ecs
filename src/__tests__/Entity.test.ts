import { describe, it, expect } from "vitest";
import {
  entityIndex,
  entityGeneration,
  makeEntityId,
  EntityPool,
} from "../core/Entity.js";

describe("Entity ID encoding", () => {
  it("packs and unpacks index correctly", () => {
    const id = makeEntityId(42, 0);
    expect(entityIndex(id)).toBe(42);
    expect(entityGeneration(id)).toBe(0);
  });

  it("packs and unpacks generation correctly", () => {
    const id = makeEntityId(0, 7);
    expect(entityIndex(id)).toBe(0);
    expect(entityGeneration(id)).toBe(7);
  });

  it("packs both index and generation", () => {
    const id = makeEntityId(1023, 15);
    expect(entityIndex(id)).toBe(1023);
    expect(entityGeneration(id)).toBe(15);
  });

  it("handles max index (20-bit)", () => {
    const maxIndex = (1 << 20) - 1;
    const id = makeEntityId(maxIndex, 0);
    expect(entityIndex(id)).toBe(maxIndex);
  });

  it("handles max generation (12-bit)", () => {
    const maxGen = (1 << 12) - 1;
    const id = makeEntityId(0, maxGen);
    expect(entityGeneration(id)).toBe(maxGen);
  });

  it("masks overflow bits", () => {
    // Index overflow: 2^20 should wrap to 0
    const id = makeEntityId(1 << 20, 0);
    expect(entityIndex(id)).toBe(0);
  });
});

describe("EntityPool", () => {
  it("creates entities with sequential indices", () => {
    const pool = new EntityPool();
    const a = pool.create();
    const b = pool.create();
    expect(entityIndex(a)).toBe(0);
    expect(entityIndex(b)).toBe(1);
    expect(entityGeneration(a)).toBe(0);
    expect(entityGeneration(b)).toBe(0);
  });

  it("reports alive status correctly", () => {
    const pool = new EntityPool();
    const id = pool.create();
    expect(pool.isAlive(id)).toBe(true);
    pool.destroy(id);
    expect(pool.isAlive(id)).toBe(false);
  });

  it("increments generation on recycling", () => {
    const pool = new EntityPool();
    const id1 = pool.create();
    const idx = entityIndex(id1);
    expect(entityGeneration(id1)).toBe(0);

    pool.destroy(id1);
    const id2 = pool.create();
    expect(entityIndex(id2)).toBe(idx);
    expect(entityGeneration(id2)).toBe(1);
  });

  it("detects stale entity IDs (generation mismatch)", () => {
    const pool = new EntityPool();
    const staleId = pool.create();
    pool.destroy(staleId);
    const _newId = pool.create(); // same index, gen 1

    // Old ID still refers to gen 0 — should be dead.
    expect(pool.isAlive(staleId)).toBe(false);
  });

  it("tracks alive count", () => {
    const pool = new EntityPool();
    expect(pool.count).toBe(0);
    const a = pool.create();
    const b = pool.create();
    expect(pool.count).toBe(2);
    pool.destroy(a);
    expect(pool.count).toBe(1);
    pool.destroy(b);
    expect(pool.count).toBe(0);
  });

  it("destroy returns false for already-dead entity", () => {
    const pool = new EntityPool();
    const id = pool.create();
    expect(pool.destroy(id)).toBe(true);
    expect(pool.destroy(id)).toBe(false);
  });

  it("destroy returns false for invalid index", () => {
    const pool = new EntityPool();
    const bogusId = makeEntityId(999, 0);
    expect(pool.destroy(bogusId)).toBe(false);
  });

  it("recycles multiple entities correctly", () => {
    const pool = new EntityPool();
    const ids = [pool.create(), pool.create(), pool.create()];
    for (const id of ids) pool.destroy(id);
    expect(pool.count).toBe(0);

    // All three indices should be recycled.
    const recycled = [pool.create(), pool.create(), pool.create()];
    for (const id of recycled) {
      expect(entityGeneration(id)).toBe(1);
    }
    expect(pool.count).toBe(3);
  });

  it("generation wraps around at 12-bit max", () => {
    const pool = new EntityPool();
    const maxGen = (1 << 12) - 1; // 4095

    // Create and destroy to increment generation to max.
    let id = pool.create();
    for (let i = 0; i < maxGen; i++) {
      pool.destroy(id);
      id = pool.create();
    }
    expect(entityGeneration(id)).toBe(maxGen);

    // One more recycle wraps generation to 0.
    pool.destroy(id);
    id = pool.create();
    expect(entityGeneration(id)).toBe(0);
  });
});
