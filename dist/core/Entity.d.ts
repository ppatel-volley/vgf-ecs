/**
 * Entity ID encoding: 20-bit index + 12-bit generation packed into a number.
 *
 * - Index: bits 0–19  → up to 1,048,576 entities
 * - Generation: bits 20–31 → 4,096 recycles before wrap
 *
 * Inspired by EnTT's versioned entity IDs.
 */
/** Branded numeric type for entity identifiers. */
export type EntityId = number;
/** Sentinel value representing no entity / null reference. */
export declare const NULL_ENTITY: EntityId;
/** Extract the index portion of an entity ID. */
export declare function entityIndex(id: EntityId): number;
/** Extract the generation portion of an entity ID. */
export declare function entityGeneration(id: EntityId): number;
/** Pack an index and generation into an entity ID. */
export declare function makeEntityId(index: number, generation: number): EntityId;
/**
 * Manages allocation and recycling of entity IDs with generation counters.
 */
export declare class EntityPool {
    /** Current generation per index slot. */
    private readonly generations;
    /** Free-list of recyclable indices. */
    private readonly freeIndices;
    /** Tracks which indices are currently alive. */
    private readonly alive;
    /** Next fresh index (never yet allocated). */
    private nextIndex;
    /** Number of currently alive entities. */
    private aliveCount;
    get count(): number;
    /** Allocate a new entity ID or recycle a destroyed one. */
    create(): EntityId;
    /** Destroy an entity, incrementing its generation for stale-reference detection. */
    destroy(id: EntityId): boolean;
    /** Check whether an entity ID is still alive (correct generation). */
    isAlive(id: EntityId): boolean;
    /**
     * Create an entity with a specific ID (for snapshot/delta restore).
     * Expands the pool to accommodate the index and sets the generation.
     */
    createWithId(id: EntityId): void;
    /** Reset the pool to empty state. */
    reset(): void;
}
//# sourceMappingURL=Entity.d.ts.map