/**
 * Component type registration.
 *
 * Components are plain TypeScript classes. Each class constructor
 * serves as the component's type identifier.
 */
/** Internal auto-incrementing ID assigned to each registered component type. */
let nextComponentId = 0;
const componentIdMap = new WeakMap();
const componentNameMap = new WeakMap();
/**
 * Get or assign a stable numeric ID for a component class.
 * IDs are assigned on first access and remain stable for the process lifetime.
 */
export function getComponentId(klass) {
    let id = componentIdMap.get(klass);
    if (id === undefined) {
        id = nextComponentId++;
        componentIdMap.set(klass, id);
    }
    return id;
}
/**
 * Get the registered name for a component class.
 * Falls back to the constructor name if not explicitly registered.
 */
export function getComponentName(klass) {
    return componentNameMap.get(klass) ?? klass.name;
}
/**
 * Register a component class with an optional explicit name.
 * Returns the assigned numeric ID.
 */
export function registerComponent(klass, name) {
    const id = getComponentId(klass);
    if (name !== undefined) {
        componentNameMap.set(klass, name);
    }
    return id;
}
//# sourceMappingURL=Component.js.map