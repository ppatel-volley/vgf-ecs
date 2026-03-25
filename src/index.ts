// ── Core ──
export {
  type EntityId,
  NULL_ENTITY,
  entityIndex,
  entityGeneration,
  makeEntityId,
  EntityPool,
} from "./core/Entity.js";

export {
  type ComponentClass,
  getComponentId,
  getComponentName,
  registerComponent,
} from "./core/Component.js";

export { SparseSet } from "./core/SparseSet.js";

export { World } from "./core/World.js";

export { QueryBuilder, type CachedQuery } from "./core/Query.js";

export {
  type SystemFn,
  type SystemRecord,
  type SystemError,
} from "./core/System.js";

export { type Command, CommandQueue } from "./core/CommandQueue.js";

// ── Hierarchy ──
export { Transform } from "./hierarchy/Transform.js";

export { hierarchySystem } from "./hierarchy/HierarchySystem.js";

export { reparent, detach, getWorldPosition } from "./hierarchy/reparent.js";

// ── VGF Integration ──
export { SessionWorld } from "./vgf/SessionWorld.js";

export { VGFAdapter } from "./vgf/VGFAdapter.js";

// ── Networking ──
export {
  registerComponentForSerialization,
  getComponentByName,
  getSerializationName,
  clearComponentRegistry,
} from "./networking/ComponentRegistry.js";

export { DirtyTracker, type DirtyEntry } from "./networking/DirtyTracker.js";

export {
  DeltaEncoder,
  type ComponentDelta,
  type WorldDelta,
} from "./networking/DeltaEncoder.js";

export {
  captureSnapshot,
  applySnapshot,
  type WorldSnapshot,
  type EntitySnapshot,
  type ComponentSnapshot,
  type SingletonSnapshot,
} from "./networking/Snapshot.js";
