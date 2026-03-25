// ── Core ──
export { NULL_ENTITY, entityIndex, entityGeneration, makeEntityId, EntityPool, } from "./core/Entity.js";
export { getComponentId, getComponentName, registerComponent, } from "./core/Component.js";
export { SparseSet } from "./core/SparseSet.js";
export { World } from "./core/World.js";
export { QueryBuilder } from "./core/Query.js";
export { CommandQueue } from "./core/CommandQueue.js";
// ── Hierarchy ──
export { Transform } from "./hierarchy/Transform.js";
export { hierarchySystem } from "./hierarchy/HierarchySystem.js";
export { reparent, detach, getWorldPosition } from "./hierarchy/reparent.js";
// ── VGF Integration ──
export { SessionWorld } from "./vgf/SessionWorld.js";
export { VGFAdapter } from "./vgf/VGFAdapter.js";
// ── Networking ──
export { registerComponentForSerialization, getComponentByName, getSerializationName, clearComponentRegistry, } from "./networking/ComponentRegistry.js";
export { DirtyTracker } from "./networking/DirtyTracker.js";
export { DeltaEncoder, } from "./networking/DeltaEncoder.js";
export { captureSnapshot, applySnapshot, } from "./networking/Snapshot.js";
//# sourceMappingURL=index.js.map