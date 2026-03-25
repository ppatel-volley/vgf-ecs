/**
 * Component registry for serialisation — maps class names to constructors.
 *
 * Components must be registered before delta decode can reconstruct them.
 */
import type { ComponentClass } from "../core/Component.js";
/**
 * Register a component class for serialisation/deserialisation.
 * The name is used as the wire-format identifier.
 */
export declare function registerComponentForSerialization<T>(name: string, type: ComponentClass<T>): void;
/**
 * Look up a component class by its serialisation name.
 */
export declare function getComponentByName(name: string): ComponentClass | undefined;
/**
 * Look up the serialisation name for a component class.
 * Falls back to the constructor name if not explicitly registered.
 */
export declare function getSerializationName(type: ComponentClass): string;
/**
 * Clear the registry (useful for test isolation).
 */
export declare function clearComponentRegistry(): void;
//# sourceMappingURL=ComponentRegistry.d.ts.map