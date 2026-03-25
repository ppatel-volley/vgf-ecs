/**
 * Generic sparse set — the core EnTT-inspired data structure.
 *
 * Provides O(1) add/has/get/remove and O(n) dense iteration.
 * Removal uses swap-and-pop to keep the dense array compact.
 */
export class SparseSet {
    /** Maps entity index → position in dense/data arrays. */
    sparse = [];
    /** Packed entity indices (for iteration). */
    dense = [];
    /** Packed component data (parallel to dense). */
    data = [];
    /** Number of entries. */
    get size() {
        return this.dense.length;
    }
    /** Check if a key exists. */
    has(key) {
        const di = this.sparse[key];
        return di !== undefined && di < this.dense.length && this.dense[di] === key;
    }
    /** Get the data for a key, or undefined if absent. */
    get(key) {
        const di = this.sparse[key];
        if (di === undefined || di >= this.dense.length || this.dense[di] !== key) {
            return undefined;
        }
        return this.data[di];
    }
    /** Add or overwrite data for a key. Returns the stored data. */
    set(key, value) {
        const di = this.sparse[key];
        if (di !== undefined && di < this.dense.length && this.dense[di] === key) {
            // Overwrite existing.
            this.data[di] = value;
            return value;
        }
        // Append new entry.
        const newIndex = this.dense.length;
        this.sparse[key] = newIndex;
        this.dense.push(key);
        this.data.push(value);
        return value;
    }
    /** Remove by key. Returns true if removed, false if not present. */
    remove(key) {
        const di = this.sparse[key];
        if (di === undefined || di >= this.dense.length || this.dense[di] !== key) {
            return false;
        }
        // Swap with last element, then pop.
        const lastIndex = this.dense.length - 1;
        if (di !== lastIndex) {
            const lastKey = this.dense[lastIndex];
            this.dense[di] = lastKey;
            this.data[di] = this.data[lastIndex];
            this.sparse[lastKey] = di;
        }
        this.dense.pop();
        this.data.pop();
        this.sparse[key] = undefined;
        return true;
    }
    /** Iterate all keys. */
    keys() {
        return this.dense;
    }
    /** Iterate all values. */
    values() {
        return this.data;
    }
    /** Clear all entries. */
    clear() {
        this.sparse.length = 0;
        this.dense.length = 0;
        this.data.length = 0;
    }
    /** Iterate [key, value] pairs. */
    *entries() {
        for (let i = 0; i < this.dense.length; i++) {
            yield [this.dense[i], this.data[i]];
        }
    }
}
//# sourceMappingURL=SparseSet.js.map