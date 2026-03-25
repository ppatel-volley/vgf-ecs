/**
 * SessionWorld — a World subclass scoped to a VGF session.
 *
 * Enables dirty tracking by default so deltas can be extracted after each tick.
 * Provides a convenience `processTick` that runs all systems and returns the delta.
 */
import { World } from "../core/World.js";
import type { WorldDelta } from "../networking/DeltaEncoder.js";

export class SessionWorld extends World {
  constructor(sessionId: string) {
    super({ sessionId });
    this.enableDirtyTracking();
  }

  /**
   * Process one game tick: run all systems, produce delta.
   * This is the primary entry point for VGF game loops.
   */
  processTick(dt: number): WorldDelta {
    this.tick(dt);
    return this.getDelta();
  }
}
