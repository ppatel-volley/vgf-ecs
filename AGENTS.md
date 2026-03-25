# ECS Agent Instructions

When working with `@volley/vgf-ecs`:

1. **Systems are plain functions:** `(world: World, dt: number) => void` — register with `world.addSystem("Name", fn, priority)`
2. **Always use `world.each()` for iteration** — not manual `getComponent()` loops. It resolves components automatically and is type-safe.
3. **Register components before using delta decode or snapshot restore:** `registerComponentForSerialization("Name", Class)`
4. **Use CommandQueue for event-driven logic** — enqueue with `world.enqueueCommand({ type: "...", ... })`, consume with `world.getCommands("type")`. Commands are cleared at the end of each tick.
5. **Test pattern:** create World, add entities/components, register systems, tick, assert state changes
6. **Never import from TokenRaider** — this package is standalone with zero game dependencies
7. **Mark components dirty after mutation** — call `world.markDirty(eid, ComponentType)` for networking deltas to capture the change
8. **Use `world.time` and `world.tickCount`** — never `Date.now()` or `performance.now()` in systems. Determinism is required.
9. **Entity IDs can be recycled** — always check `world.isAlive(eid)` before using a stored entity ID
10. **Deferred ops flush between systems** — entity creation/destruction and component add/remove during a system are queued and applied between systems. Call `world.flushDeferred()` for explicit mid-system flushing (rare).

## Quick Reference

```typescript
// Create world
const world = new World({ sessionId: "test" });

// Entities
const e = world.createEntity();
const child = world.createEntity(parent);

// Components
world.addComponent(e, MyComponent, { field: value });
const comp = world.getComponent(e, MyComponent);

// Queries
world.each(A, B, (eid, a, b) => { /* ... */ });
const ids = world.query(A, B).without(C).execute();

// Systems
world.addSystem("Name", (world, dt) => { /* ... */ }, priority);
world.tick(1/60);

// Commands
world.enqueueCommand({ type: "action", payload: data });
world.getCommands("action"); // in a system

// Networking
world.enableDirtyTracking();
world.markDirty(eid, Component);
const delta = world.getDelta();
clientWorld.applyDelta(delta);

// Singletons
world.setSingleton(Config, { key: value });
world.getSingleton(Config);
```

## VGFAdapter API (Strict)

The VGFAdapter uses a strict API — world creation is explicit:

```typescript
const adapter = new VGFAdapter();
adapter.createWorld("session-id");   // throws if already exists
adapter.getWorld("session-id");      // throws if not found
adapter.getOrCreateWorld("session-id"); // lenient — creates if missing
```

**Do NOT assume `getWorld()` creates worlds implicitly.** Call `createWorld()` during session setup, then `getWorld()` for subsequent access.

## Common Mistakes

- **Calling `adapter.getWorld()` before `createWorld()`** — it throws. Use `hasWorld()` to check, or `getOrCreateWorld()` only in dev mode.
- **Forgetting `markDirty()`** — component mutations are invisible to delta encoding without it.
- **Using `Date.now()` in systems** — use `world.time` for deterministic behaviour.
- **Storing entity IDs long-term** — IDs can be recycled. Always check `world.isAlive(eid)`.
- **Mutating `getChildren()` result** — it returns a copy; mutating it has no effect.
- **Importing TokenRaider types into vgf-ecs** — this package must remain game-agnostic.
- **Forgetting `registerComponentForSerialization()`** — required before delta decode or snapshot restore can reconstruct components.

## File Map

| Path | Purpose |
|------|---------|
| `src/core/World.ts` | Central registry — entities, components, systems, queries |
| `src/core/Entity.ts` | Entity ID encoding (20-bit index + 12-bit generation) |
| `src/core/Component.ts` | Component type registration |
| `src/core/System.ts` | SystemFn type definition |
| `src/core/Query.ts` | QueryBuilder with caching |
| `src/core/SparseSet.ts` | O(1) sparse set data structure |
| `src/core/CommandQueue.ts` | Typed command queue |
| `src/hierarchy/Transform.ts` | Transform component (local + world space) |
| `src/hierarchy/HierarchySystem.ts` | World-space computation system |
| `src/hierarchy/reparent.ts` | Hierarchy utility functions |
| `src/networking/DirtyTracker.ts` | Component change tracking |
| `src/networking/DeltaEncoder.ts` | Delta encode/decode |
| `src/networking/Snapshot.ts` | Full snapshot capture/restore |
| `src/networking/ComponentRegistry.ts` | Serialisation name registry |
| `src/vgf/SessionWorld.ts` | Session-scoped world |
| `src/vgf/VGFAdapter.ts` | Multi-session management |
| `src/index.ts` | Public API barrel export |
