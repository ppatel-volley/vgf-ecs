/**
 * QueryBuilder — returned by `world.query(A, B)`.
 * Call `.without(C)` for exclusion, `.execute()` to materialise results.
 */
export class QueryBuilder {
    world;
    required;
    excluded = [];
    constructor(world, required) {
        this.world = world;
        this.required = required;
    }
    /** Exclude entities that have the given component(s). */
    without(...types) {
        this.excluded.push(...types);
        return this;
    }
    /** Execute the query and return matching entity IDs. */
    execute() {
        return this.world.executeQuery(this.required, this.excluded);
    }
}
//# sourceMappingURL=Query.js.map