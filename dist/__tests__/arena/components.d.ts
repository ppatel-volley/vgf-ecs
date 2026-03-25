/**
 * Arena Brawl — test components.
 *
 * A self-contained mini-game exercising every ECS framework feature.
 * NO game dependencies — purely for validation.
 */
export declare class Position {
    x: number;
    z: number;
}
export declare class Velocity {
    speed: number;
    angle: number;
}
export declare class Health {
    current: number;
    max: number;
}
export declare class CollisionRadius {
    radius: number;
}
export declare class Team {
    id: number;
}
export declare class DamageIntent {
    targetId: number;
    amount: number;
}
export declare class Dead {
    at: number;
}
//# sourceMappingURL=components.d.ts.map