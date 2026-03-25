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
export type ComponentClass<T = any> = new (...args: any[]) => T;
/**
 * Get or assign a stable numeric ID for a component class.
 * IDs are assigned on first access and remain stable for the process lifetime.
 */
export declare function getComponentId(klass: ComponentClass): number;
/**
 * Get the registered name for a component class.
 * Falls back to the constructor name if not explicitly registered.
 */
export declare function getComponentName(klass: ComponentClass): string;
/**
 * Register a component class with an optional explicit name.
 * Returns the assigned numeric ID.
 */
export declare function registerComponent<T>(klass: ComponentClass<T>, name?: string): number;
//# sourceMappingURL=Component.d.ts.map