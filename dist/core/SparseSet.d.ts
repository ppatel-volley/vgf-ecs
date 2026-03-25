/**
 * Generic sparse set — the core EnTT-inspired data structure.
 *
 * Provides O(1) add/has/get/remove and O(n) dense iteration.
 * Removal uses swap-and-pop to keep the dense array compact.
 */
export declare class SparseSet<T> {
    /** Maps entity index → position in dense/data arrays. */
    private readonly sparse;
    /** Packed entity indices (for iteration). */
    private readonly dense;
    /** Packed component data (parallel to dense). */
    private readonly data;
    /** Number of entries. */
    get size(): number;
    /** Check if a key exists. */
    has(key: number): boolean;
    /** Get the data for a key, or undefined if absent. */
    get(key: number): T | undefined;
    /** Add or overwrite data for a key. Returns the stored data. */
    set(key: number, value: T): T;
    /** Remove by key. Returns true if removed, false if not present. */
    remove(key: number): boolean;
    /** Iterate all keys. */
    keys(): ReadonlyArray<number>;
    /** Iterate all values. */
    values(): ReadonlyArray<T>;
    /** Clear all entries. */
    clear(): void;
    /** Iterate [key, value] pairs. */
    entries(): IterableIterator<[number, T]>;
}
//# sourceMappingURL=SparseSet.d.ts.map