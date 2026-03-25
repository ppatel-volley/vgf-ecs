/**
 * Typed command queue — bridges event-driven input (VGF thunks, voice commands)
 * and tick-driven ECS systems.
 *
 * Commands are enqueued between ticks (or during systems), consumed by
 * command-handler systems during the tick, and cleared at the end of each tick.
 */
export class CommandQueue {
    commands = [];
    /** Enqueue a command for processing during the next (or current) tick. */
    enqueue(command) {
        this.commands.push(command);
    }
    /** Get all commands of a given type. */
    getByType(type) {
        return this.commands.filter((c) => c.type === type);
    }
    /** Get all enqueued commands. */
    getAll() {
        return this.commands;
    }
    /** Clear all commands. Called at the end of each tick. */
    clear() {
        this.commands.length = 0;
    }
    /** Number of enqueued commands. */
    get size() {
        return this.commands.length;
    }
}
//# sourceMappingURL=CommandQueue.js.map