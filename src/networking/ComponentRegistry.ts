/**
 * Component registry for serialisation — maps class names to constructors.
 *
 * Components must be registered before delta decode can reconstruct them.
 */
import type { ComponentClass } from "../core/Component.js";

const nameToClass = new Map<string, ComponentClass>();
const classToName = new Map<ComponentClass, string>();

/**
 * Register a component class for serialisation/deserialisation.
 * The name is used as the wire-format identifier.
 */
export function registerComponentForSerialization<T>(
  name: string,
  type: ComponentClass<T>,
): void {
  nameToClass.set(name, type);
  classToName.set(type, name);
}

/**
 * Look up a component class by its serialisation name.
 */
export function getComponentByName(name: string): ComponentClass | undefined {
  return nameToClass.get(name);
}

/**
 * Look up the serialisation name for a component class.
 * Falls back to the constructor name if not explicitly registered.
 */
export function getSerializationName(type: ComponentClass): string {
  return classToName.get(type) ?? type.name;
}

/**
 * Clear the registry (useful for test isolation).
 */
export function clearComponentRegistry(): void {
  nameToClass.clear();
  classToName.clear();
}
