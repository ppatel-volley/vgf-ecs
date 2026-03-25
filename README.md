# @volley/vgf-ecs

> A custom Entity Component System for Volley Games Framework, inspired by
> EnTT and Flecs. Designed for multiplayer game servers and displays.

## Quick Start

```typescript
import { World, Transform, hierarchySystem } from "@volley/vgf-ecs";

// 1. Create a world
const world = new World({ sessionId: "my-session" });

// 2. Define a component (plain class)
class Velocity {
  speed = 0;
  angle = 0;
}

// 3. Create entities and add components
const ship = world.createEntity();
world.addComponent(ship, Transform, { localX: 0, localZ: 0 });
world.addComponent(ship, Velocity, { speed: 10, angle: 0 });

// 4. Write a system (plain function)
function movementSystem(world: World, dt: number): void {
  world.each(Transform, Velocity, (eid, t, v) => {
    t.localX += Math.cos(v.angle) * v.speed * dt;
    t.localZ += Math.sin(v.angle) * v.speed * dt;
  });
}

// 5. Register systems and tick
world.addSystem("HierarchySystem", hierarchySystem, 0);
world.addSystem("MovementSystem", movementSystem, 1);

world.tick(1 / 60); // runs all systems in priority order
```

## Core Concepts

### Entities

Entities are lightweight numeric ID handles. They carry no data themselves — data lives in components attached to them.

```typescript
const entity = world.createEntity();       // allocate a new entity
const child = world.createEntity(parent);  // create as child of parent
world.isAlive(entity);                      // check if still valid
world.destroyEntity(entity);               // destroy (cascades to children)
```

**Entity ID encoding:** 20-bit index + 12-bit generation packed into a single number. The generation counter increments each time an index is recycled, preventing stale reference bugs. Use `world.isAlive(eid)` to check validity before accessing a stored entity ID.

### Components

Components are plain TypeScript classes with default field values. No TypedArrays, no decorators, no special base class required.

```typescript
class Health {
  current = 100;
  max = 100;
}

class Velocity {
  speed = 0;
  angle = 0;
}
```

**Usage:**

```typescript
world.addComponent(entity, Health, { current: 50, max: 100 });
const health = world.getComponent(entity, Health);  // Health | null
world.hasComponent(entity, Health);                   // boolean
world.removeComponent(entity, Health);
```

**Registration for serialisation:** Components must be registered before delta decode or snapshot restore can reconstruct them:

```typescript
import { registerComponentForSerialization } from "@volley/vgf-ecs";
registerComponentForSerialization("Health", Health);
```

### Systems

Systems are plain functions with priority ordering. Lower priority numbers run first. Systems receive the world and delta time.

```typescript
function combatSystem(world: World, dt: number): void {
  world.each(Health, (eid, health) => {
    if (health.current <= 0) {
      world.addComponent(eid, Dead, { at: world.tickCount });
    }
  });
}

world.addSystem("CombatSystem", combatSystem, 3);
```

**Key behaviours:**
- Systems execute in priority order (stable sort — same priority preserves registration order)
- Deferred ops (entity creation/destruction, component add/remove) are flushed between each system
- If a system throws, the error is captured and the next system continues
- Access errors via `world.getTickErrors()`

### Queries

Queries find entities matching a component composition. Results are cached and invalidated on structural changes.

```typescript
// Builder pattern — returns EntityId[]
const movers = world.query(Transform, Velocity).execute();
const anchored = world.query(Transform).without(Anchored).execute();

// Ergonomic callback iteration (preferred for most systems)
world.each(Transform, Velocity, (eid, transform, velocity) => {
  transform.localX += velocity.speed * dt;
});

// Typed iterable — returns [EntityId, ...components] tuples
for (const [eid, t, v] of world.queryWith(Transform, Velocity)) {
  t.localX += v.speed * dt;
}
```

**Cache invalidation:** The world maintains a `structuralVersion` counter that increments on any entity/component structural change. Queries compare their cached version against this counter and rebuild when stale.

### Entity Hierarchy

Entities support optional parent-child relationships. Destroying a parent cascades to all descendants (depth-first).

```typescript
const ship = world.createEntity();
const turret = world.createEntity(ship);  // child of ship

world.getParent(turret);     // ship
world.getChildren(ship);     // [turret] (returns a copy)
world.setParent(turret, otherShip);  // reparent
world.removeParent(turret);  // detach to root

world.destroyEntity(ship);  // also destroys turret
```

**Utility functions:**

```typescript
import { reparent, detach, getWorldPosition } from "@volley/vgf-ecs";

reparent(world, child, newParent);
detach(world, child);
const pos = getWorldPosition(world, entity);
// { x: number, z: number, rotationY: number } | null
```

### Transform Component

The built-in `Transform` component stores local-space and computed world-space position/rotation.

```typescript
import { Transform, hierarchySystem } from "@volley/vgf-ecs";

world.addComponent(entity, Transform, {
  localX: 10,
  localZ: 20,
  localRotationY: Math.PI / 4,
});

// Register HierarchySystem to compute world-space transforms each tick
world.addSystem("HierarchySystem", hierarchySystem, 0);
world.tick(dt);

const t = world.getComponent(entity, Transform)!;
// t.worldX, t.worldZ, t.worldRotationY — computed from parent chain
```

**Fields:**
- `localX`, `localZ`, `localRotationY` — relative to parent (or world origin if root)
- `worldX`, `worldZ`, `worldRotationY` — computed by HierarchySystem

### Networking

#### Dirty Tracking

Opt-in component change tracking for efficient delta encoding.

```typescript
world.enableDirtyTracking();

// After mutating a component, mark it dirty:
const t = world.getComponent(entity, Transform)!;
t.localX += 10;
world.markDirty(entity, Transform);
```

#### Delta Encoding

Produce minimal updates containing only what changed since the last flush.

```typescript
// Server: produce delta after tick
const delta = world.getDelta(); // WorldDelta — also flushes dirty tracker

// Client: apply delta
clientWorld.applyDelta(delta);
```

**WorldDelta structure:**
```typescript
interface WorldDelta {
  tickCount: number;
  time: number;
  created: number[];       // entity IDs created
  destroyed: number[];     // entity IDs destroyed
  components: ComponentDelta[];  // changed component data
}
```

#### Snapshots

Full world serialisation for initial sync or reconnection.

```typescript
// Server: capture full state
const snapshot = world.captureSnapshot(); // WorldSnapshot

// Client: apply snapshot (clears world first)
clientWorld.applySnapshot(snapshot);
```

### VGF Integration

#### SessionWorld

A World subclass scoped to a VGF session. Dirty tracking is enabled by default.

```typescript
import { SessionWorld } from "@volley/vgf-ecs";

const world = new SessionWorld("session-123");
// Dirty tracking is already enabled

const delta = world.processTick(1 / 60);
// Runs all systems, then returns the delta
```

#### VGFAdapter

Manages multiple SessionWorld instances — one per VGF session. Uses a strict API where world creation is explicit.

```typescript
import { VGFAdapter } from "@volley/vgf-ecs";

const adapter = new VGFAdapter();

// Explicit creation — throws if world already exists
const world = adapter.createWorld("session-123");

// Strict retrieval — throws if world doesn't exist
const existing = adapter.getWorld("session-123");

// Lenient retrieval — creates if missing (dev mode convenience)
const lenient = adapter.getOrCreateWorld("session-123");

adapter.hasWorld("session-123"); // true

const delta = adapter.processTick("session-123", 1 / 60);

adapter.destroyWorld("session-123"); // cleanup
adapter.sessionCount; // number of active sessions
```

#### CommandQueue Bridge Pattern

Commands bridge VGF's event-driven model (voice commands, button presses) to ECS's tick-driven model.

```typescript
// Enqueue from VGF thunk or voice handler:
world.enqueueCommand({ type: "fire_cannon", playerId: ship, targetId: enemy });

// Process in a system:
function combatCommandSystem(world: World, dt: number): void {
  for (const cmd of world.getCommands("fire_cannon")) {
    const targetHealth = world.getComponent(cmd.targetId as number, Health);
    if (targetHealth) targetHealth.current -= 25;
  }
}

// Commands are cleared automatically at the end of each tick.
```

### Singletons

World-level data that doesn't belong to a specific entity.

```typescript
class GameConfig {
  arenaRadius = 500;
  maxPlayers = 4;
}

world.setSingleton(GameConfig, { arenaRadius: 200, maxPlayers: 8 });
const config = world.getSingleton(GameConfig);
world.removeSingleton(GameConfig);
```

## API Reference

### World

| Method | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `(options?: { sessionId?: string })` | Create a new world |
| `createEntity` | `(parent?: EntityId) => EntityId` | Create entity, optionally as child |
| `destroyEntity` | `(id: EntityId) => void` | Destroy entity and cascade to children |
| `isAlive` | `(id: EntityId) => boolean` | Check if entity is alive |
| `entityCount` | `number` (getter) | Number of alive entities |
| `addComponent` | `<T>(id, type, data?) => T` | Add component to entity |
| `getComponent` | `<T>(id, type) => T \| null` | Get component from entity |
| `hasComponent` | `<T>(id, type) => boolean` | Check if entity has component |
| `removeComponent` | `<T>(id, type) => void` | Remove component from entity |
| `setSingleton` | `<T>(type, data?) => T` | Set a singleton component |
| `getSingleton` | `<T>(type) => T \| null` | Get a singleton component |
| `removeSingleton` | `<T>(type) => void` | Remove a singleton component |
| `query` | `(...types) => QueryBuilder` | Start building a query |
| `each` | `(types..., callback) => void` | Iterate with resolved components |
| `queryWith` | `(...types) => Iterable<[EntityId, ...T]>` | Typed tuple iterator |
| `addSystem` | `(name, fn, priority?) => void` | Register a system |
| `removeSystem` | `(name) => void` | Unregister a system |
| `tick` | `(dt: number) => void` | Run one tick (all systems) |
| `getTickErrors` | `() => SystemError[]` | Get errors from last tick |
| `enqueueCommand` | `(command: Command) => void` | Enqueue a command |
| `getCommands` | `(type: string) => Command[]` | Get commands by type |
| `clearCommands` | `() => void` | Clear all commands |
| `setParent` | `(child, parent) => void` | Set entity parent |
| `removeParent` | `(child) => void` | Detach from parent |
| `getParent` | `(id) => EntityId \| null` | Get parent entity |
| `getChildren` | `(id) => EntityId[]` | Get children (copy) |
| `enableDirtyTracking` | `() => void` | Enable dirty tracking |
| `disableDirtyTracking` | `() => void` | Disable dirty tracking |
| `markDirty` | `(entityId, componentType) => void` | Mark component dirty |
| `getDirtyTracker` | `() => DirtyTracker \| null` | Access dirty tracker |
| `getDelta` | `() => WorldDelta` | Encode and flush dirty state |
| `applyDelta` | `(delta: WorldDelta) => void` | Apply delta (client-side) |
| `captureSnapshot` | `() => WorldSnapshot` | Full world snapshot |
| `applySnapshot` | `(snapshot: WorldSnapshot) => void` | Apply snapshot (clears first) |
| `clear` | `() => void` | Clear all entities/components/state |
| `flushDeferred` | `() => void` | Flush deferred structural ops |
| `time` | `number` | Elapsed time (accumulated from dt) |
| `tickCount` | `number` | Integer tick counter |
| `sessionId` | `string` | Session identifier |

### SessionWorld

Extends `World`. Dirty tracking enabled by default.

| Method | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `(sessionId: string)` | Create session-scoped world |
| `processTick` | `(dt: number) => WorldDelta` | Tick + return delta |

### VGFAdapter

| Method | Signature | Description |
|--------|-----------|-------------|
| `createWorld` | `(sessionId: string) => SessionWorld` | Create new world (throws if exists) |
| `getWorld` | `(sessionId: string) => SessionWorld` | Get existing world (throws if missing) |
| `getOrCreateWorld` | `(sessionId: string) => SessionWorld` | Get or create world (lenient) |
| `hasWorld` | `(sessionId: string) => boolean` | Check if world exists |
| `destroyWorld` | `(sessionId: string) => void` | Destroy and cleanup |
| `processTick` | `(sessionId, dt) => WorldDelta` | Tick a session |
| `sessionCount` | `number` (getter) | Active session count |
| `getSessionIds` | `() => string[]` | All active session IDs |

### Utility Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `registerComponentForSerialization` | `(name, type) => void` | Register for serialisation |
| `getComponentByName` | `(name) => ComponentClass \| undefined` | Look up by name |
| `getSerializationName` | `(type) => string` | Get wire-format name |
| `clearComponentRegistry` | `() => void` | Clear registry (tests) |
| `hierarchySystem` | `(world, dt) => void` | Built-in hierarchy system |
| `reparent` | `(world, child, parent) => void` | Reparent entity |
| `detach` | `(world, child) => void` | Detach from parent |
| `getWorldPosition` | `(world, entity) => {...} \| null` | Get world-space position |

## For AI Agents

> This section is for AI coding agents (Claude Code, Cursor, etc.) working
> with this framework.

### Key Patterns

**Creating a system:**
```typescript
function mySystem(world: World, dt: number): void {
  world.each(ComponentA, ComponentB, (eid, a, b) => {
    // process entities with both ComponentA and ComponentB
  });
}
world.addSystem("MySystem", mySystem, priority);
```

**Querying entities:**
```typescript
world.each(Transform, Velocity, (eid, t, v) => {
  t.localX += v.speed * dt;
});
```

**Handling commands:**
```typescript
for (const cmd of world.getCommands("fire_cannon")) {
  // process command
}
```

**Marking dirty (required for networking):**
```typescript
world.markDirty(eid, Transform); // after mutating Transform data
```

**Networking round-trip:**
```typescript
// Server
const server = new SessionWorld("session-1");
server.addSystem("Movement", movementSystem, 1);
const delta = server.processTick(1/60);

// Client
const client = new World();
client.applyDelta(delta);
```

### Common Mistakes

- **Don't use `Date.now()` in systems** — use `world.time` for deterministic behaviour
- **Don't store entity IDs long-term** — they may be recycled; check `world.isAlive(eid)` first
- **Don't mutate `getChildren()` result** — it returns a copy
- **Register components before delta decode:** `registerComponentForSerialization("Name", Class)`
- **Don't forget `markDirty()`** — component mutations are not auto-tracked; call `world.markDirty(eid, Type)` after mutating component data for networking deltas to include the change
- **Systems must be pure functions of world state** — no external mutable state, no closures over shared variables between sessions

### File Structure

```
packages/vgf-ecs/
  src/
    core/
      Entity.ts          # EntityId type, EntityPool, generation encoding
      World.ts           # Central registry: entities, components, systems, queries
      Component.ts       # Component registration, ComponentClass type
      System.ts          # SystemFn type, SystemRecord, SystemError
      Query.ts           # QueryBuilder, CachedQuery, cache invalidation
      SparseSet.ts       # Generic sparse set (O(1) add/remove/get, O(n) iterate)
      CommandQueue.ts    # Typed command ingestion (enqueue, consume, clear)
    hierarchy/
      Transform.ts       # Transform component (local + world space)
      HierarchySystem.ts # Computes world-space transforms from parent chain
      reparent.ts        # Utility: reparent, detach, getWorldPosition
    networking/
      DirtyTracker.ts    # Component change tracking for delta encoding
      DeltaEncoder.ts    # WorldDelta creation and application
      ComponentRegistry.ts # Name-to-class mapping for serialisation
      Snapshot.ts        # Full world snapshot capture and restore
    vgf/
      SessionWorld.ts    # Session-scoped World with dirty tracking
      VGFAdapter.ts      # Multi-session management bridge
    index.ts             # Public API barrel export
```

## Examples

### Movement System

```typescript
import { World, Transform } from "@volley/vgf-ecs";

class Velocity { speed = 0; angle = 0; }

function movementSystem(world: World, dt: number): void {
  world.each(Transform, Velocity, (eid, t, v) => {
    t.localX += Math.cos(v.angle) * v.speed * dt;
    t.localZ += Math.sin(v.angle) * v.speed * dt;
    world.markDirty(eid, Transform);
  });
}

const world = new World();
world.addSystem("Movement", movementSystem, 1);

const ship = world.createEntity();
world.addComponent(ship, Transform, { localX: 0, localZ: 0 });
world.addComponent(ship, Velocity, { speed: 10, angle: 0 });

world.tick(1/60);
// ship's Transform.localX is now ~0.167
```

### Combat with Commands

```typescript
import { World } from "@volley/vgf-ecs";

class Health { current = 100; max = 100; }
class Dead { at = 0; }

function combatSystem(world: World, dt: number): void {
  for (const cmd of world.getCommands("damage")) {
    const targetId = cmd.targetId as number;
    if (!world.isAlive(targetId)) continue;

    const health = world.getComponent(targetId, Health);
    if (!health || world.hasComponent(targetId, Dead)) continue;

    health.current = Math.max(0, health.current - (cmd.amount as number));
    world.markDirty(targetId, Health);
  }
}

function deathSystem(world: World, dt: number): void {
  world.each(Health, (eid, health) => {
    if (health.current <= 0 && !world.hasComponent(eid, Dead)) {
      world.addComponent(eid, Dead, { at: world.tickCount });
    }
  });
}

const world = new World();
world.addSystem("Combat", combatSystem, 3);
world.addSystem("Death", deathSystem, 4);

const enemy = world.createEntity();
world.addComponent(enemy, Health, { current: 100, max: 100 });

world.enqueueCommand({ type: "damage", targetId: enemy, amount: 100 });
world.tick(1/60);

world.hasComponent(enemy, Dead); // true
```

### Networking Round-Trip

```typescript
import {
  SessionWorld, World,
  registerComponentForSerialization,
  Transform
} from "@volley/vgf-ecs";

class Velocity { speed = 0; angle = 0; }

// Register components for serialisation
registerComponentForSerialization("Transform", Transform);
registerComponentForSerialization("Velocity", Velocity);

// Server
const server = new SessionWorld("game-session");
server.addSystem("Movement", (world, dt) => {
  world.each(Transform, Velocity, (eid, t, v) => {
    t.localX += Math.cos(v.angle) * v.speed * dt;
    t.localZ += Math.sin(v.angle) * v.speed * dt;
    world.markDirty(eid, Transform);
  });
}, 1);

const ship = server.createEntity();
server.addComponent(ship, Transform, { localX: 0, localZ: 0 });
server.addComponent(ship, Velocity, { speed: 10, angle: 0 });

// Initial sync via snapshot
const snapshot = server.captureSnapshot();

// Client
const client = new World({ sessionId: "display" });
client.applySnapshot(snapshot);

// Per-tick sync via deltas
for (let i = 0; i < 60; i++) {
  const delta = server.processTick(1/60);
  client.applyDelta(delta);
}

// Client state matches server
const serverT = server.getComponent(ship, Transform)!;
const clientT = client.getComponent(ship, Transform)!;
// clientT.localX === serverT.localX (within floating-point tolerance)
```
