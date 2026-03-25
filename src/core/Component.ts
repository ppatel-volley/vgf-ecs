/**
 * Component type registration.
 *
 * Components are plain TypeScript classes. Each class constructor
 * serves as the component's type identifier.
 */

/**
 * A component class — any constructor that produces a component instance.
 * Used as the type key for component storage and queries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentClass<T = any> = new (...args: any[]) => T;

/** Internal auto-incrementing ID assigned to each registered component type. */
let nextComponentId = 0;

const componentIdMap = new WeakMap<ComponentClass, number>();
const componentNameMap = new WeakMap<ComponentClass, string>();

/**
 * Get or assign a stable numeric ID for a component class.
 * IDs are assigned on first access and remain stable for the process lifetime.
 */
export function getComponentId(klass: ComponentClass): number {
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
export function getComponentName(klass: ComponentClass): string {
  return componentNameMap.get(klass) ?? klass.name;
}

/**
 * Register a component class with an optional explicit name.
 * Returns the assigned numeric ID.
 */
export function registerComponent<T>(
  klass: ComponentClass<T>,
  name?: string,
): number {
  const id = getComponentId(klass);
  if (name !== undefined) {
    componentNameMap.set(klass, name);
  }
  return id;
}
