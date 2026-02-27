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
  $$refId: number;
};

/**
 * Create a single client component reference
 */
export function clientRef<P = Record<string, unknown>>(
  moduleId: string,
  exportName: string,
  refId: number,
): ClientReference<P> {
  const reference = (() => null) as unknown as ClientReference<P>;
  reference.$$typeof = CLIENT_REFERENCE_SYMBOL;
  reference.$$id = `${moduleId}#${exportName}`;
  reference.$$refId = refId;
  return reference;
}

type ComponentModule = Record<string, ComponentType<any>>;
type ClientReferences<M extends ComponentModule> = {
  [K in keyof M]: ClientReference<ComponentProps<M[K]>>;
};

/**
 * Create typed client references from a module type.
 * refIdMap must map "moduleId#exportName" to numeric ref id.
 */
export function createClientRefs<M extends ComponentModule>(
  moduleId: string,
  exportNames: (keyof M & string)[],
  refIdMap: Map<string, number>,
): ClientReferences<Pick<M, (typeof exportNames)[number]>> {
  const refs = {} as ClientReferences<Pick<M, (typeof exportNames)[number]>>;
  for (const name of exportNames) {
    const refId = refIdMap.get(`${moduleId}#${name}`);
    if (refId == null) {
      throw new Error(`[rsc-prism] Missing refId for "${moduleId}#${name}" in createClientRefs.`);
    }
    refs[name] = clientRef(moduleId, name, refId);
  }
  return refs;
}

/**
 * Build client manifest and references together.
 * refIdMap must map "moduleId#exportName" to numeric ref id.
 */
export function createClientModule<M extends ComponentModule>(
  moduleId: string,
  exportNames: (keyof M & string)[],
  refIdMap: Map<string, number>,
): {
  manifest: ClientManifest;
  refs: ClientReferences<Pick<M, (typeof exportNames)[number]>>;
} {
  const hashIndex = moduleId.lastIndexOf("#");
  const normalizedModuleId = hashIndex === -1 ? moduleId : moduleId.slice(0, hashIndex);
  const manifest: ClientManifest = buildClientManifestBaseUrl(normalizedModuleId);
  const refs = createClientRefs<M>(moduleId, exportNames, refIdMap);
  return { manifest, refs };
}
