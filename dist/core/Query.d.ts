/**
 * Query system — cached queries over entity component composition.
 *
 * Uses a global structural version counter for cache invalidation:
 * when any entity's component composition changes, the version bumps,
 * and stale queries rebuild on next access.
 */
import type { EntityId } from "./Entity.js";
import type { ComponentClass } from "./Component.js";
import type { World } from "./World.js";
/**
 * QueryBuilder — returned by `world.query(A, B)`.
 * Call `.without(C)` for exclusion, `.execute()` to materialise results.
 */
export declare class QueryBuilder {
    private readonly world;
    private readonly required;
    private excluded;
    constructor(world: World, required: ComponentClass[]);
    /** Exclude entities that have the given component(s). */
    without(...types: ComponentClass[]): QueryBuilder;
    /** Execute the query and return matching entity IDs. */
    execute(): EntityId[];
}
/**
 * Internal cached query record.
 * Keyed by a canonical string of required + excluded component IDs.
 */
export interface CachedQuery {
    key: string;
    required: ComponentClass[];
    excluded: ComponentClass[];
    result: EntityId[];
    version: number;
}
//# sourceMappingURL=Query.d.ts.map