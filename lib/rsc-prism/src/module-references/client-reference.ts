/**
 * Client Reference Utilities
 *
 * Create typed client component references for use in server components.
 * These work with JSX and provide full type safety.
 */
import type { ComponentType, ComponentProps } from "react";
import type { ClientManifest } from "../types";
import { buildClientManifestBaseUrl } from "../runtime/module-registry";
import { CLIENT_REFERENCE_SYMBOL } from "./constants";

/**
 * A client reference that can be used in JSX
 */
export type ClientReference<P = unknown> = ComponentType<P> & {
  $$typeof: typeof CLIENT_REFERENCE_SYMBOL;
  $$id: string;
};

/**
 * Create a single client component reference
 */
export function clientRef<P = Record<string, unknown>>(
  moduleId: string,
  exportName: string,
): ClientReference<P> {
  const reference = (() => null) as unknown as ClientReference<P>;
  reference.$$typeof = CLIENT_REFERENCE_SYMBOL;
  reference.$$id = `${moduleId}#${exportName}`;
  return reference;
}

type ComponentModule = Record<string, ComponentType<any>>;
type ClientReferences<M extends ComponentModule> = {
  [K in keyof M]: ClientReference<ComponentProps<M[K]>>;
};

/**
 * Create typed client references from a module type
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
 */
export function createClientModule<M extends ComponentModule>(
  moduleId: string,
  exportNames: (keyof M & string)[],
): {
  manifest: ClientManifest;
  refs: ClientReferences<Pick<M, (typeof exportNames)[number]>>;
} {
  const hashIndex = moduleId.lastIndexOf("#");
  const normalizedModuleId = hashIndex === -1 ? moduleId : moduleId.slice(0, hashIndex);
  const manifest: ClientManifest = buildClientManifestBaseUrl(normalizedModuleId);
  const refs = createClientRefs<M>(moduleId, exportNames);
  return { manifest, refs };
}
