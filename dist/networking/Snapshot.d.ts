/**
 * Snapshot — full world serialisation for initial sync and reconnection.
 *
 * captureSnapshot: serialises all entities, components, hierarchy, and singletons.
 * applySnapshot: clears the world and populates from the snapshot.
 */
import type { World } from "../core/World.js";
export interface ComponentSnapshot {
    type: string;
    schemaVersion: number;
    data: Record<string, unknown>;
}
export interface EntitySnapshot {
    id: number;
    parentId: number | null;
    components: ComponentSnapshot[];
}
export interface SingletonSnapshot {
    type: string;
    data: Record<string, unknown>;
}
export interface WorldSnapshot {
    tickCount: number;
    time: number;
    entities: EntitySnapshot[];
    singletons: SingletonSnapshot[];
}
/**
 * Capture a full snapshot of the world state.
 */
export declare function captureSnapshot(world: World): WorldSnapshot;
/**
 * Apply a snapshot to a world — CLEARS the world first, then populates.
 */
export declare function applySnapshot(world: World, snapshot: WorldSnapshot): void;
//# sourceMappingURL=Snapshot.d.ts.map