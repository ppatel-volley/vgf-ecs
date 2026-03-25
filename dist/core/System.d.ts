/**
 * System types — systems are plain functions registered with the World.
 */
import type { World } from "./World.js";
/** A system is a plain function that receives the world and delta time. */
export type SystemFn = (world: World, dt: number) => void;
/** Internal system record stored by the World. */
export interface SystemRecord {
    name: string;
    fn: SystemFn;
    priority: number;
}
/** Error captured from a system during a tick. */
export interface SystemError {
    systemName: string;
    tickCount: number;
    error: unknown;
}
//# sourceMappingURL=System.d.ts.map