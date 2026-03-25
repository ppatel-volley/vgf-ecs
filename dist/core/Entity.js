/**
 * Entity ID encoding: 20-bit index + 12-bit generation packed into a number.
 *
 * - Index: bits 0–19  → up to 1,048,576 entities
 * - Generation: bits 20–31 → 4,096 recycles before wrap
 *
 * Inspired by EnTT's versioned entity IDs.
 */
/** Sentinel value representing no entity / null reference. */
export const NULL_ENTITY = -1;
const INDEX_BITS = 20;
const GEN_BITS = 12;
const INDEX_MASK = (1 << INDEX_BITS) - 1; // 0xFFFFF
const GEN_MASK = (1 << GEN_BITS) - 1; // 0xFFF
const MAX_ENTITIES = 1 << INDEX_BITS; // 1,048,576
/** Extract the index portion of an entity ID. */
export function entityIndex(id) {
    return id & INDEX_MASK;
}
/** Extract the generation portion of an entity ID. */
export function entityGeneration(id) {
    return (id >>> INDEX_BITS) & GEN_MASK;
}
/** Pack an index and generation into an entity ID. */
export function makeEntityId(index, generation) {
    return ((generation & GEN_MASK) << INDEX_BITS) | (index & INDEX_MASK);
}
/**
 * Manages allocation and recycling of entity IDs with generation counters.
 */
export class EntityPool {
    /** Current generation per index slot. */
    generations = [];
    /** Free-list of recyclable indices. */
    freeIndices = [];
    /** Tracks which indices are currently alive. */
    alive = [];
    /** Next fresh index (never yet allocated). */
    nextIndex = 0;
    /** Number of currently alive entities. */
    aliveCount = 0;
    get count() {
        return this.aliveCount;
    }
    /** Allocate a new entity ID or recycle a destroyed one. */
    create() {
        let index;
        let gen;
        if (this.freeIndices.length > 0) {
            index = this.freeIndices.pop();
            gen = this.generations[index];
        }
        else {
            if (this.nextIndex >= MAX_ENTITIES) {
                throw new Error(`Entity limit reached (${MAX_ENTITIES}). Cannot create more entities.`);
            }
            index = this.nextIndex++;
            gen = 0;
            this.generations[index] = 0;
        }
        this.alive[index] = true;
        this.aliveCount++;
        return makeEntityId(index, gen);
    }
    /** Destroy an entity, incrementing its generation for stale-reference detection. */
    destroy(id) {
        const index = entityIndex(id);
        const gen = entityGeneration(id);
        if (index >= this.nextIndex ||
            !this.alive[index] ||
            this.generations[index] !== gen) {
            return false;
        }
        this.alive[index] = false;
        this.generations[index] = (gen + 1) & GEN_MASK;
        this.freeIndices.push(index);
        this.aliveCount--;
        return true;
    }
    /** Check whether an entity ID is still alive (correct generation). */
    isAlive(id) {
        const index = entityIndex(id);
        if (index >= this.nextIndex)
            return false;
        return this.alive[index] && this.generations[index] === entityGeneration(id);
    }
    /**
     * Create an entity with a specific ID (for snapshot/delta restore).
     * Expands the pool to accommodate the index and sets the generation.
     */
    createWithId(id) {
        const index = entityIndex(id);
        const gen = entityGeneration(id);
        // Expand to accommodate this index
        while (this.nextIndex <= index) {
            this.generations[this.nextIndex] = 0;
            this.alive[this.nextIndex] = false;
            this.nextIndex++;
        }
        // If already alive at this index, skip
        if (this.alive[index] && this.generations[index] === gen) {
            return;
        }
        this.generations[index] = gen;
        this.alive[index] = true;
        this.aliveCount++;
        // Remove from free list if present
        const freeIdx = this.freeIndices.indexOf(index);
        if (freeIdx !== -1) {
            this.freeIndices.splice(freeIdx, 1);
        }
    }
    /** Reset the pool to empty state. */
    reset() {
        this.generations.length = 0;
        this.freeIndices.length = 0;
        this.alive.length = 0;
        this.nextIndex = 0;
        this.aliveCount = 0;
    }
}
//# sourceMappingURL=Entity.js.map