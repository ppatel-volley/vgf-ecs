import { describe, it, expect } from "vitest";
import { SparseSet } from "../core/SparseSet.js";
describe("SparseSet", () => {
    it("starts empty", () => {
        const set = new SparseSet();
        expect(set.size).toBe(0);
        expect(set.has(0)).toBe(false);
    });
    it("adds and retrieves a value", () => {
        const set = new SparseSet();
        set.set(5, "hello");
        expect(set.has(5)).toBe(true);
        expect(set.get(5)).toBe("hello");
        expect(set.size).toBe(1);
    });
    it("returns undefined for missing key", () => {
        const set = new SparseSet();
        expect(set.get(99)).toBeUndefined();
    });
    it("overwrites existing value", () => {
        const set = new SparseSet();
        set.set(3, 10);
        set.set(3, 20);
        expect(set.get(3)).toBe(20);
        expect(set.size).toBe(1);
    });
    it("removes an entry", () => {
        const set = new SparseSet();
        set.set(1, 100);
        expect(set.remove(1)).toBe(true);
        expect(set.has(1)).toBe(false);
        expect(set.size).toBe(0);
    });
    it("remove returns false for nonexistent key", () => {
        const set = new SparseSet();
        expect(set.remove(42)).toBe(false);
    });
    it("swap-and-pop maintains density after removal", () => {
        const set = new SparseSet();
        set.set(0, "a");
        set.set(1, "b");
        set.set(2, "c");
        // Remove middle element.
        set.remove(1);
        expect(set.size).toBe(2);
        expect(set.has(0)).toBe(true);
        expect(set.has(2)).toBe(true);
        expect(set.get(0)).toBe("a");
        expect(set.get(2)).toBe("c");
    });
    it("iterates all keys", () => {
        const set = new SparseSet();
        set.set(10, 1);
        set.set(20, 2);
        set.set(30, 3);
        expect([...set.keys()].sort((a, b) => a - b)).toEqual([10, 20, 30]);
    });
    it("iterates all values", () => {
        const set = new SparseSet();
        set.set(0, 10);
        set.set(1, 20);
        set.set(2, 30);
        expect([...set.values()].sort((a, b) => a - b)).toEqual([10, 20, 30]);
    });
    it("iterates entries", () => {
        const set = new SparseSet();
        set.set(5, "five");
        set.set(10, "ten");
        const entries = [...set.entries()];
        expect(entries).toHaveLength(2);
        const map = new Map(entries);
        expect(map.get(5)).toBe("five");
        expect(map.get(10)).toBe("ten");
    });
    it("clears all entries", () => {
        const set = new SparseSet();
        set.set(0, 1);
        set.set(1, 2);
        set.clear();
        expect(set.size).toBe(0);
        expect(set.has(0)).toBe(false);
    });
    it("handles large sparse indices", () => {
        const set = new SparseSet();
        set.set(100000, 42);
        expect(set.get(100000)).toBe(42);
        expect(set.size).toBe(1);
    });
    it("multiple independent sets do not interfere", () => {
        const a = new SparseSet();
        const b = new SparseSet();
        a.set(0, 1);
        b.set(0, 2);
        expect(a.get(0)).toBe(1);
        expect(b.get(0)).toBe(2);
    });
    it("removal order does not corrupt data", () => {
        const set = new SparseSet();
        for (let i = 0; i < 10; i++)
            set.set(i, i * 10);
        // Remove in various orders.
        set.remove(5);
        set.remove(0);
        set.remove(9);
        expect(set.size).toBe(7);
        for (let i = 1; i <= 8; i++) {
            if (i === 5) {
                expect(set.has(i)).toBe(false);
            }
            else {
                expect(set.get(i)).toBe(i * 10);
            }
        }
    });
    it("stores object references", () => {
        const set = new SparseSet();
        const obj = { x: 42 };
        set.set(0, obj);
        const got = set.get(0);
        expect(got).toBe(obj); // Same reference.
        got.x = 99;
        expect(set.get(0).x).toBe(99);
    });
});
//# sourceMappingURL=SparseSet.test.js.map