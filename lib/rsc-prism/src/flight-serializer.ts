/**
 * Flight serializer helpers backed by the internal runtime.
 */

import { registerServerReference } from "./flight-runtime/server";
import { annotateServerReference as annotateRuntimeServerReference } from "./flight-runtime/references";

const DEFAULT_SERVER_ACTION_REGISTRY_LIMIT = 1024;

type ServerActionFn = (...args: unknown[]) => unknown;
const serverActions = new Map<string, ServerActionFn>();
let serverActionRegistryLimit = DEFAULT_SERVER_ACTION_REGISTRY_LIMIT;

function annotateServerReference<T extends (...args: any[]) => any>(id: string, fn: T): T {
  return annotateRuntimeServerReference(fn, id);
}

function setServerAction(id: string, fn: ServerActionFn): void {
  if (serverActions.has(id)) {
    serverActions.delete(id);
    serverActions.set(id, fn);
    return;
  }

  while (serverActions.size >= serverActionRegistryLimit) {
    const oldest = serverActions.keys().next().value;
    if (oldest == null) break;
    serverActions.delete(oldest);
  }

  serverActions.set(id, fn);
}

export function configureServerActionRegistry(options?: { maxEntries?: number }): void {
  const maxEntries = options?.maxEntries ?? DEFAULT_SERVER_ACTION_REGISTRY_LIMIT;
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("maxEntries must be a positive integer");
  }

  serverActionRegistryLimit = maxEntries;

  while (serverActions.size > serverActionRegistryLimit) {
    const oldest = serverActions.keys().next().value;
    if (oldest == null) break;
    serverActions.delete(oldest);
  }
}

export function clearServerActionRegistry(): void {
  serverActions.clear();
}

/**
 * Create a server action reference that can be passed to client components.
 */
export function createServerAction<T extends (...args: any[]) => any>(id: string, fn: T): T {
  const annotated = annotateServerReference(id, fn);
  try {
    const registered = registerServerReference(annotated, id, id);
    setServerAction(id, registered as unknown as ServerActionFn);
    return registered;
  } catch {
    setServerAction(id, annotated as unknown as ServerActionFn);
    return annotated;
  }
}

/**
 * Get a registered server action by ID.
 */
export function getServerAction(id: string): ((...args: unknown[]) => unknown) | undefined {
  return serverActions.get(id);
}
