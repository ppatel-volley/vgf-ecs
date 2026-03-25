const nameToClass = new Map();
const classToName = new Map();
/**
 * Register a component class for serialisation/deserialisation.
 * The name is used as the wire-format identifier.
 */
export function registerComponentForSerialization(name, type) {
    nameToClass.set(name, type);
    classToName.set(type, name);
}
/**
 * Look up a component class by its serialisation name.
 */
export function getComponentByName(name) {
    return nameToClass.get(name);
}
/**
 * Look up the serialisation name for a component class.
 * Falls back to the constructor name if not explicitly registered.
 */
export function getSerializationName(type) {
    return classToName.get(type) ?? type.name;
}
/**
 * Clear the registry (useful for test isolation).
 */
export function clearComponentRegistry() {
    nameToClass.clear();
    classToName.clear();
}
//# sourceMappingURL=ComponentRegistry.js.map