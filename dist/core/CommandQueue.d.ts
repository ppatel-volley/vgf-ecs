/**
 * Typed command queue — bridges event-driven input (VGF thunks, voice commands)
 * and tick-driven ECS systems.
 *
 * Commands are enqueued between ticks (or during systems), consumed by
 * command-handler systems during the tick, and cleared at the end of each tick.
 */
/** A command is a typed message with an arbitrary payload. */
export interface Command {
    type: string;
    [key: string]: unknown;
}
export declare class CommandQueue {
    private readonly commands;
    /** Enqueue a command for processing during the next (or current) tick. */
    enqueue(command: Command): void;
    /** Get all commands of a given type. */
    getByType(type: string): Command[];
    /** Get all enqueued commands. */
    getAll(): ReadonlyArray<Command>;
    /** Clear all commands. Called at the end of each tick. */
    clear(): void;
    /** Number of enqueued commands. */
    get size(): number;
}
//# sourceMappingURL=CommandQueue.d.ts.map