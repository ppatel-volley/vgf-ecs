import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../core/World.js";
import { DeltaEncoder } from "../networking/DeltaEncoder.js";
import { registerComponentForSerialization, clearComponentRegistry, } from "../networking/ComponentRegistry.js";
class Position {
    x = 0;
    z = 0;
}
class Velocity {
    speed = 0;
    maxSpeed = 10;
}
describe("DeltaEncoder", () => {
    let encoder;
    beforeEach(() => {
        clearComponentRegistry();
        registerComponentForSerialization("Position", Position);
        registerComponentForSerialization("Velocity", Velocity);
        encoder = new DeltaEncoder();
    });
    it("encode: dirty component produces ComponentDelta with correct data", () => {
        const world = new World();
        world.enableDirtyTracking();
        const e = world.createEntity();
        world.addComponent(e, Position, { x: 10, z: 20 });
        const delta = encoder.encode(world);
        expect(delta.components).toHaveLength(1);
        expect(delta.components[0].componentType).toBe("Position");
        expect(delta.components[0].data).toMatchObject({ x: 10, z: 20 });
        expect(delta.components[0].entityId).toBe(e);
        expect(delta.components[0].schemaVersion).toBe(1);
    });
    it("encode: created entities included", () => {
        const world = new World();
        world.enableDirtyTracking();
        const e1 = world.createEntity();
        const e2 = world.createEntity();
        const delta = encoder.encode(world);
        expect(delta.created).toContain(e1);
        expect(delta.created).toContain(e2);
    });
    it("encode: destroyed entities included", () => {
        const world = new World();
        world.enableDirtyTracking();
        const e = world.createEntity();
        // Flush to clear creation tracking
        world.getDirtyTracker().flush();
        world.destroyEntity(e);
        const delta = encoder.encode(world);
        expect(delta.destroyed).toContain(e);
    });
    it("encode: clean world produces empty delta", () => {
        const world = new World();
        world.enableDirtyTracking();
        const delta = encoder.encode(world);
        expect(delta.created).toHaveLength(0);
        expect(delta.destroyed).toHaveLength(0);
        expect(delta.components).toHaveLength(0);
    });
    it("encode: world without dirty tracking produces empty delta", () => {
        const world = new World();
        // dirty tracking NOT enabled
        const delta = encoder.encode(world);
        expect(delta.components).toHaveLength(0);
        expect(delta.created).toHaveLength(0);
    });
    it("decode: creates new entities", () => {
        const clientWorld = new World();
        encoder.decode(clientWorld, {
            tickCount: 1,
            time: 0.016,
            created: [0],
            destroyed: [],
            components: [],
        });
        expect(clientWorld.isAlive(0)).toBe(true);
    });
    it("decode: destroys entities", () => {
        const clientWorld = new World();
        const e = clientWorld.createEntity();
        encoder.decode(clientWorld, {
            tickCount: 1,
            time: 0.016,
            created: [],
            destroyed: [e],
            components: [],
        });
        expect(clientWorld.isAlive(e)).toBe(false);
    });
    it("decode: upserts components on existing entities", () => {
        const clientWorld = new World();
        const e = clientWorld.createEntity();
        encoder.decode(clientWorld, {
            tickCount: 1,
            time: 0.016,
            created: [],
            destroyed: [],
            components: [
                {
                    entityId: e,
                    componentType: "Position",
                    schemaVersion: 1,
                    data: { x: 42, z: 99 },
                },
            ],
        });
        const pos = clientWorld.getComponent(e, Position);
        expect(pos).not.toBeNull();
        expect(pos.x).toBe(42);
        expect(pos.z).toBe(99);
    });
    it("decode: updates existing component data", () => {
        const clientWorld = new World();
        const e = clientWorld.createEntity();
        clientWorld.addComponent(e, Position, { x: 0, z: 0 });
        encoder.decode(clientWorld, {
            tickCount: 1,
            time: 0.016,
            created: [],
            destroyed: [],
            components: [
                {
                    entityId: e,
                    componentType: "Position",
                    schemaVersion: 1,
                    data: { x: 100, z: 200 },
                },
            ],
        });
        const pos = clientWorld.getComponent(e, Position);
        expect(pos.x).toBe(100);
        expect(pos.z).toBe(200);
    });
    it("round-trip: encode then decode on second world", () => {
        const serverWorld = new World();
        serverWorld.enableDirtyTracking();
        const e = serverWorld.createEntity();
        serverWorld.addComponent(e, Position, { x: 50, z: 75 });
        serverWorld.addComponent(e, Velocity, { speed: 5, maxSpeed: 20 });
        const delta = encoder.encode(serverWorld);
        const clientWorld = new World();
        encoder.decode(clientWorld, delta);
        expect(clientWorld.isAlive(e)).toBe(true);
        const pos = clientWorld.getComponent(e, Position);
        expect(pos.x).toBe(50);
        expect(pos.z).toBe(75);
        const vel = clientWorld.getComponent(e, Velocity);
        expect(vel.speed).toBe(5);
        expect(vel.maxSpeed).toBe(20);
    });
    it("encode includes tickCount and time", () => {
        const world = new World();
        world.enableDirtyTracking();
        world.tick(0.5);
        const delta = encoder.encode(world);
        expect(delta.tickCount).toBe(1);
        expect(delta.time).toBeCloseTo(0.5);
    });
    it("decode skips unknown component types gracefully", () => {
        const clientWorld = new World();
        const e = clientWorld.createEntity();
        // Should not throw
        encoder.decode(clientWorld, {
            tickCount: 1,
            time: 0,
            created: [],
            destroyed: [],
            components: [
                {
                    entityId: e,
                    componentType: "UnknownComponent",
                    schemaVersion: 1,
                    data: { foo: "bar" },
                },
            ],
        });
        // Entity still alive, just no component added
        expect(clientWorld.isAlive(e)).toBe(true);
    });
});
//# sourceMappingURL=DeltaEncoder.test.js.map