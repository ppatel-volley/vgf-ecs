import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../core/World.js";
import { Transform } from "../hierarchy/Transform.js";
import { hierarchySystem } from "../hierarchy/HierarchySystem.js";
import { reparent, detach, getWorldPosition } from "../hierarchy/reparent.js";
describe("Hierarchy + Transform", () => {
    let world;
    beforeEach(() => {
        world = new World({ sessionId: "hierarchy-test" });
        world.addSystem("HierarchySystem", hierarchySystem, 0);
    });
    // ── Root entity ──
    it("root entity: world = local", () => {
        const e = world.createEntity();
        world.addComponent(e, Transform, { localX: 10, localZ: 20, localRotationY: 0.5 });
        world.tick(1 / 60);
        const t = world.getComponent(e, Transform);
        expect(t.worldX).toBe(10);
        expect(t.worldZ).toBe(20);
        expect(t.worldRotationY).toBe(0.5);
    });
    // ── Child entity ──
    it("child entity: world computed from parent + local", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, { localX: 100, localZ: 200 });
        const child = world.createEntity(parent);
        world.addComponent(child, Transform, { localX: 10, localZ: 20 });
        world.tick(1 / 60);
        const ct = world.getComponent(child, Transform);
        // Parent has no rotation, so world = parent.world + local
        expect(ct.worldX).toBe(110);
        expect(ct.worldZ).toBe(220);
    });
    // ── Nested hierarchy (grandchild) ──
    it("nested hierarchy: grandchild world computed through chain", () => {
        const root = world.createEntity();
        world.addComponent(root, Transform, { localX: 100, localZ: 0 });
        const child = world.createEntity(root);
        world.addComponent(child, Transform, { localX: 50, localZ: 0 });
        const grandchild = world.createEntity(child);
        world.addComponent(grandchild, Transform, { localX: 25, localZ: 0 });
        world.tick(1 / 60);
        const gt = world.getComponent(grandchild, Transform);
        expect(gt.worldX).toBe(175); // 100 + 50 + 25
        expect(gt.worldZ).toBe(0);
    });
    // ── Reparent ──
    it("reparent: world position updates after reparent", () => {
        const parentA = world.createEntity();
        world.addComponent(parentA, Transform, { localX: 100, localZ: 0 });
        const parentB = world.createEntity();
        world.addComponent(parentB, Transform, { localX: 200, localZ: 0 });
        const child = world.createEntity(parentA);
        world.addComponent(child, Transform, { localX: 10, localZ: 0 });
        world.tick(1 / 60);
        expect(world.getComponent(child, Transform).worldX).toBe(110);
        // Reparent to parentB
        reparent(world, child, parentB);
        world.tick(1 / 60);
        expect(world.getComponent(child, Transform).worldX).toBe(210);
    });
    // ── Detach ──
    it("detach: becomes root, world = local", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, { localX: 100, localZ: 0 });
        const child = world.createEntity(parent);
        world.addComponent(child, Transform, { localX: 10, localZ: 0 });
        world.tick(1 / 60);
        expect(world.getComponent(child, Transform).worldX).toBe(110);
        detach(world, child);
        world.tick(1 / 60);
        expect(world.getComponent(child, Transform).worldX).toBe(10);
    });
    // ── Rotated parent ──
    it("rotated parent: child world position rotated correctly", () => {
        const parent = world.createEntity();
        // Parent at origin, rotated 90 degrees (PI/2)
        world.addComponent(parent, Transform, {
            localX: 0,
            localZ: 0,
            localRotationY: Math.PI / 2,
        });
        const child = world.createEntity(parent);
        // Child 10 units along X in local space
        world.addComponent(child, Transform, { localX: 10, localZ: 0 });
        world.tick(1 / 60);
        const ct = world.getComponent(child, Transform);
        // After 90-degree rotation: X -> Z, Z -> -X
        // worldX = 0 + 10 * cos(PI/2) - 0 * sin(PI/2) ≈ 0
        // worldZ = 0 + 10 * sin(PI/2) + 0 * cos(PI/2) ≈ 10
        expect(ct.worldX).toBeCloseTo(0, 10);
        expect(ct.worldZ).toBeCloseTo(10, 10);
        expect(ct.worldRotationY).toBeCloseTo(Math.PI / 2, 10);
    });
    // ── Multiple children ──
    it("multiple children: each computed independently", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, { localX: 100, localZ: 0 });
        const childA = world.createEntity(parent);
        world.addComponent(childA, Transform, { localX: 10, localZ: 0 });
        const childB = world.createEntity(parent);
        world.addComponent(childB, Transform, { localX: 20, localZ: 0 });
        world.tick(1 / 60);
        expect(world.getComponent(childA, Transform).worldX).toBe(110);
        expect(world.getComponent(childB, Transform).worldX).toBe(120);
    });
    // ── Entity without Transform parent ──
    it("entity with parent that has no Transform: world = local", () => {
        const parent = world.createEntity();
        // Parent has NO Transform component
        const child = world.createEntity(parent);
        world.addComponent(child, Transform, { localX: 42, localZ: 7 });
        world.tick(1 / 60);
        const ct = world.getComponent(child, Transform);
        expect(ct.worldX).toBe(42);
        expect(ct.worldZ).toBe(7);
    });
    // ── Destroy parent: children destroyed ──
    it("destroy parent: children destroyed via cascade", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, { localX: 0, localZ: 0 });
        const child = world.createEntity(parent);
        world.addComponent(child, Transform, { localX: 10, localZ: 0 });
        world.destroyEntity(parent);
        expect(world.isAlive(parent)).toBe(false);
        expect(world.isAlive(child)).toBe(false);
    });
    // ── getWorldPosition utility ──
    it("getWorldPosition returns correct world-space values", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, { localX: 50, localZ: 30 });
        const child = world.createEntity(parent);
        world.addComponent(child, Transform, { localX: 10, localZ: 5 });
        world.tick(1 / 60);
        const pos = getWorldPosition(world, child);
        expect(pos).not.toBeNull();
        expect(pos.x).toBe(60);
        expect(pos.z).toBe(35);
    });
    it("getWorldPosition returns null for entity without Transform", () => {
        const e = world.createEntity();
        expect(getWorldPosition(world, e)).toBeNull();
    });
    // ── Rotated parent with offset child ──
    it("rotated parent with Z-offset child", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, {
            localX: 0,
            localZ: 0,
            localRotationY: Math.PI / 2,
        });
        const child = world.createEntity(parent);
        world.addComponent(child, Transform, { localX: 0, localZ: 10 });
        world.tick(1 / 60);
        const ct = world.getComponent(child, Transform);
        // worldX = 0 + 0*cos(PI/2) - 10*sin(PI/2) = -10
        // worldZ = 0 + 0*sin(PI/2) + 10*cos(PI/2) = 0
        expect(ct.worldX).toBeCloseTo(-10, 10);
        expect(ct.worldZ).toBeCloseTo(0, 10);
    });
    // ── World rotation accumulation ──
    it("world rotation accumulates through hierarchy", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, { localRotationY: 1.0 });
        const child = world.createEntity(parent);
        world.addComponent(child, Transform, { localRotationY: 0.5 });
        const grandchild = world.createEntity(child);
        world.addComponent(grandchild, Transform, { localRotationY: 0.3 });
        world.tick(1 / 60);
        expect(world.getComponent(grandchild, Transform).worldRotationY).toBeCloseTo(1.8, 10);
    });
    // ── Multiple roots ──
    it("multiple roots processed independently", () => {
        const rootA = world.createEntity();
        world.addComponent(rootA, Transform, { localX: 10 });
        const rootB = world.createEntity();
        world.addComponent(rootB, Transform, { localX: 20 });
        world.tick(1 / 60);
        expect(world.getComponent(rootA, Transform).worldX).toBe(10);
        expect(world.getComponent(rootB, Transform).worldX).toBe(20);
    });
    // ── Transform updates on subsequent ticks ──
    it("transform updates when local values change", () => {
        const e = world.createEntity();
        const t = world.addComponent(e, Transform, { localX: 10 });
        world.tick(1 / 60);
        expect(t.worldX).toBe(10);
        t.localX = 50;
        world.tick(1 / 60);
        expect(t.worldX).toBe(50);
    });
    // ── Deeply nested hierarchy ──
    it("deeply nested hierarchy (4 levels) computes correctly", () => {
        let current = world.createEntity();
        world.addComponent(current, Transform, { localX: 10 });
        for (let i = 0; i < 3; i++) {
            const child = world.createEntity(current);
            world.addComponent(child, Transform, { localX: 10 });
            current = child;
        }
        world.tick(1 / 60);
        // 4 levels, each +10 = 40
        expect(world.getComponent(current, Transform).worldX).toBe(40);
    });
    // ── Reparent from one parent to another preserves local ──
    it("reparent preserves local transform values", () => {
        const parentA = world.createEntity();
        world.addComponent(parentA, Transform, { localX: 0 });
        const parentB = world.createEntity();
        world.addComponent(parentB, Transform, { localX: 500 });
        const child = world.createEntity(parentA);
        world.addComponent(child, Transform, { localX: 10, localZ: 20, localRotationY: 0.5 });
        reparent(world, child, parentB);
        // Local values should be unchanged
        const ct = world.getComponent(child, Transform);
        expect(ct.localX).toBe(10);
        expect(ct.localZ).toBe(20);
        expect(ct.localRotationY).toBe(0.5);
    });
    // ── Identity rotation (zero rotation) ──
    it("zero rotation parent: child world = parent.world + child.local", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, { localX: 50, localZ: 50, localRotationY: 0 });
        const child = world.createEntity(parent);
        world.addComponent(child, Transform, { localX: 10, localZ: -5 });
        world.tick(1 / 60);
        const ct = world.getComponent(child, Transform);
        expect(ct.worldX).toBe(60);
        expect(ct.worldZ).toBe(45);
        expect(ct.worldRotationY).toBe(0);
    });
    // ── Transform component default values ──
    it("Transform defaults to all zeroes", () => {
        const t = new Transform();
        expect(t.localX).toBe(0);
        expect(t.localZ).toBe(0);
        expect(t.localRotationY).toBe(0);
        expect(t.worldX).toBe(0);
        expect(t.worldZ).toBe(0);
        expect(t.worldRotationY).toBe(0);
    });
    // ── HierarchySystem as registered system in tick ──
    it("hierarchySystem works correctly when registered and called via tick", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, { localX: 100, localZ: 100 });
        const child = world.createEntity(parent);
        world.addComponent(child, Transform, { localX: -10, localZ: -10 });
        // tick runs the system
        world.tick(1 / 60);
        const ct = world.getComponent(child, Transform);
        expect(ct.worldX).toBe(90);
        expect(ct.worldZ).toBe(90);
    });
    // ── Sibling entities don't affect each other ──
    it("sibling entities are independent of each other", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, { localX: 0 });
        const siblingA = world.createEntity(parent);
        world.addComponent(siblingA, Transform, { localX: 100 });
        const siblingB = world.createEntity(parent);
        world.addComponent(siblingB, Transform, { localX: -100 });
        world.tick(1 / 60);
        expect(world.getComponent(siblingA, Transform).worldX).toBe(100);
        expect(world.getComponent(siblingB, Transform).worldX).toBe(-100);
    });
    // ── Rotated parent with both X and Z ──
    it("rotated parent: child with both localX and localZ", () => {
        const parent = world.createEntity();
        world.addComponent(parent, Transform, {
            localX: 10,
            localZ: 10,
            localRotationY: Math.PI, // 180 degrees
        });
        const child = world.createEntity(parent);
        world.addComponent(child, Transform, { localX: 5, localZ: 3 });
        world.tick(1 / 60);
        const ct = world.getComponent(child, Transform);
        // cos(PI) = -1, sin(PI) ≈ 0
        // worldX = 10 + 5*(-1) - 3*(0) = 5
        // worldZ = 10 + 5*(0) + 3*(-1) = 7
        expect(ct.worldX).toBeCloseTo(5, 10);
        expect(ct.worldZ).toBeCloseTo(7, 10);
    });
});
//# sourceMappingURL=Hierarchy.test.js.map