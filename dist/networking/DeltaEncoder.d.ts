/**
 * DeltaEncoder — converts dirty tracker state into serialisable deltas.
 *
 * Reads dirty entries from the world's DirtyTracker, serialises each
 * dirty component, and packages into a WorldDelta.
 */
import type { World } from "../core/World.js";
export interface ComponentDelta {
    entityId: number;
    componentType: string;
    schemaVersion: number;
    data: Record<string, unknown>;
}
export interface WorldDelta {
    tickCount: number;
    time: number;
    created: number[];
    destroyed: number[];
    components: ComponentDelta[];
}
export declare class DeltaEncoder {
    /**
     * Encode current dirty state into a WorldDelta.
     * Reads from the world's dirty tracker.
     */
    encode(world: World): WorldDelta;
    /**
     * Apply a WorldDelta to a world (client-side).
     * Creates entities, destroys entities, upserts components.
     */
    decode(world: World, delta: WorldDelta): void;
}
//# sourceMappingURL=DeltaEncoder.d.ts.map