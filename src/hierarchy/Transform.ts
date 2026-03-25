/**
 * Transform component — stores local-space and computed world-space position/rotation.
 *
 * Local values are relative to the parent entity.
 * World values are computed by HierarchySystem from the parent chain.
 */
export class Transform {
  // Local space (relative to parent)
  localX = 0;
  localZ = 0;
  localRotationY = 0;

  // World space (computed from hierarchy chain)
  worldX = 0;
  worldZ = 0;
  worldRotationY = 0;
}
