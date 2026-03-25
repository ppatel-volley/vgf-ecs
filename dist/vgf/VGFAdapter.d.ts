/**
 * VGFAdapter — bridge between VGF's thunk context and ECS worlds.
 *
 * Manages multiple SessionWorld instances (one per VGF session).
 * Provides lifecycle management and convenience methods for tick processing.
 */
import { SessionWorld } from "./SessionWorld.js";
import type { WorldDelta } from "../networking/DeltaEncoder.js";
export declare class VGFAdapter {
    private readonly worlds;
    /**
     * Create a new world for a session. Throws if one already exists.
     */
    createWorld(sessionId: string): SessionWorld;
    /**
     * Get an existing world for a session. Throws if not found.
     * Use hasWorld() to check existence before calling.
     */
    getWorld(sessionId: string): SessionWorld;
    /**
     * Get an existing world, or create one if it doesn't exist.
     * Use this only in contexts where implicit creation is intentional (e.g., dev mode).
     */
    getOrCreateWorld(sessionId: string): SessionWorld;
    /**
     * Check whether a world exists for a session.
     */
    hasWorld(sessionId: string): boolean;
    /**
     * Destroy a session's world and remove all state.
     */
    destroyWorld(sessionId: string): void;
    /**
     * Process a tick for a session. Returns the delta to broadcast.
     * Throws if the session world doesn't exist.
     */
    processTick(sessionId: string, dt: number): WorldDelta;
    /**
     * Get the number of active sessions.
     */
    get sessionCount(): number;
    /**
     * Get all active session IDs.
     */
    getSessionIds(): string[];
}
//# sourceMappingURL=VGFAdapter.d.ts.map