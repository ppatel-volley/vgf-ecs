/**
 * VGFAdapter — bridge between VGF's thunk context and ECS worlds.
 *
 * Manages multiple SessionWorld instances (one per VGF session).
 * Provides lifecycle management and convenience methods for tick processing.
 */
import { SessionWorld } from "./SessionWorld.js";
export class VGFAdapter {
    worlds = new Map();
    /**
     * Create a new world for a session. Throws if one already exists.
     */
    createWorld(sessionId) {
        if (this.worlds.has(sessionId)) {
            throw new Error(`World already exists for session "${sessionId}"`);
        }
        const world = new SessionWorld(sessionId);
        this.worlds.set(sessionId, world);
        return world;
    }
    /**
     * Get an existing world for a session. Throws if not found.
     * Use hasWorld() to check existence before calling.
     */
    getWorld(sessionId) {
        const world = this.worlds.get(sessionId);
        if (!world) {
            throw new Error(`No world found for session "${sessionId}". Call createWorld() first.`);
        }
        return world;
    }
    /**
     * Get an existing world, or create one if it doesn't exist.
     * Use this only in contexts where implicit creation is intentional (e.g., dev mode).
     */
    getOrCreateWorld(sessionId) {
        let world = this.worlds.get(sessionId);
        if (!world) {
            world = new SessionWorld(sessionId);
            this.worlds.set(sessionId, world);
        }
        return world;
    }
    /**
     * Check whether a world exists for a session.
     */
    hasWorld(sessionId) {
        return this.worlds.has(sessionId);
    }
    /**
     * Destroy a session's world and remove all state.
     */
    destroyWorld(sessionId) {
        const world = this.worlds.get(sessionId);
        if (world) {
            world.clear();
            this.worlds.delete(sessionId);
        }
    }
    /**
     * Process a tick for a session. Returns the delta to broadcast.
     * Throws if the session world doesn't exist.
     */
    processTick(sessionId, dt) {
        const world = this.getWorld(sessionId); // throws if missing
        return world.processTick(dt);
    }
    /**
     * Get the number of active sessions.
     */
    get sessionCount() {
        return this.worlds.size;
    }
    /**
     * Get all active session IDs.
     */
    getSessionIds() {
        return [...this.worlds.keys()];
    }
}
//# sourceMappingURL=VGFAdapter.js.map