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

export class CommandQueue {
  private readonly commands: Command[] = [];

  /** Enqueue a command for processing during the next (or current) tick. */
  enqueue(command: Command): void {
    this.commands.push(command);
  }

  /** Get all commands of a given type. */
  getByType(type: string): Command[] {
    return this.commands.filter((c) => c.type === type);
  }

  /** Get all enqueued commands. */
  getAll(): ReadonlyArray<Command> {
    return this.commands;
  }

  /** Clear all commands. Called at the end of each tick. */
  clear(): void {
    this.commands.length = 0;
  }

  /** Number of enqueued commands. */
  get size(): number {
    return this.commands.length;
  }
}
