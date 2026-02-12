/**
 * Client Reference Utilities
 *
 * Create typed client component references for use in server components.
 * These work with JSX and provide full type safety.
 */
import type { ComponentType, ComponentProps } from "react";
import type { ClientManifest } from "./types";

const REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");

/**
 * A client reference that can be used in JSX
 */
export type ClientReference<P = unknown> = ComponentType<P> & {
  $$typeof: typeof REACT_CLIENT_REFERENCE;
  $$id: string;
};

/**
 * Create a single client component reference
 *
 * @example
 * ```tsx
 * // Type-safe reference
 * const Counter = clientRef<{ count: number }>("client", "Counter");
 *
 * // In server component JSX:
 * <Counter count={42} />
 * ```
 */
export function clientRef<P = Record<string, unknown>>(
  moduleId: string,
  exportName: string,
): ClientReference<P> {
  return {
    $$typeof: REACT_CLIENT_REFERENCE,
    $$id: `${moduleId}#${exportName}`,
  } as ClientReference<P>;
}

/**
 * Type helper: Extract component type from a module
 */
type ComponentModule = Record<string, ComponentType<any>>;

/**
 * Type helper: Convert component module to client references
 */
type ClientReferences<M extends ComponentModule> = {
  [K in keyof M]: ClientReference<ComponentProps<M[K]>>;
};

/**
 * Create typed client references from a module type
 *
 * This gives you full type safety - props are inferred from your actual components.
 *
 * @example
 * ```tsx
 * // In your client components file:
 * export function Counter({ count }: { count: number }) { ... }
 * export function Button({ onClick, children }: ButtonProps) { ... }
 *
 * // In your service worker:
 * import type * as ClientComponents from "./components";
 *
 * const Client = createClientRefs<typeof ClientComponents>("client", [
 *   "Counter",
 *   "Button",
 * ]);
 *
 * // Now use with full type safety:
 * <Client.Counter count={42} />  // ✓ Type checked!
 * <Client.Counter wrong={1} />   // ✗ Type error
 * ```
 */
export function createClientRefs<M extends ComponentModule>(
  moduleId: string,
  exportNames: (keyof M & string)[],
): ClientReferences<Pick<M, (typeof exportNames)[number]>> {
  const refs = {} as ClientReferences<M>;

  for (const name of exportNames) {
    refs[name] = clientRef(moduleId, name);
  }

  return refs;
}

/**
 * Build client manifest and references together
 *
 * Convenience function that returns both the manifest (for serialization)
 * and typed refs (for JSX usage).
 *
 * @example
 * ```tsx
 * import type * as Components from "./components";
 *
 * const { manifest, refs: Client } = createClientModule<typeof Components>(
 *   "client",
 *   ["Counter", "Button", "Card"]
 * );
 *
 * // Use in JSX:
 * <Client.Counter count={0} />
 *
 * // Use manifest for serialization:
 * createFlightResponse(<App />, manifest);
 * ```
 */
export function createClientModule<M extends ComponentModule>(
  moduleId: string,
  exportNames: (keyof M & string)[],
): {
  manifest: ClientManifest;
  refs: ClientReferences<Pick<M, (typeof exportNames)[number]>>;
} {
  const manifest: ClientManifest = {
    [moduleId]: { id: moduleId, chunks: [], name: "*" },
  };

  for (const name of exportNames) {
    manifest[`${moduleId}#${name}`] = { id: moduleId, chunks: [], name };
  }

  const refs = createClientRefs<M>(moduleId, exportNames);

  return { manifest, refs };
}
