/**
 * Arena Brawl — test components.
 *
 * A self-contained mini-game exercising every ECS framework feature.
 * NO game dependencies — purely for validation.
 */
export class Position {
    x = 0;
    z = 0;
}
export class Velocity {
    speed = 0;
    angle = 0;
}
export class Health {
    current = 100;
    max = 100;
}
export class CollisionRadius {
    radius = 1;
}
export class Team {
    id = 0;
}
export class DamageIntent {
    targetId = 0;
    amount = 0;
}
export class Dead {
    at = 0;
}
//# sourceMappingURL=components.js.map