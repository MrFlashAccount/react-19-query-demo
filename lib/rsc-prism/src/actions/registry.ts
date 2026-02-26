/**
 * Action registration: register functions as callable actions by ID.
 */

import { registerServerReference } from "../flight-runtime/server";
import type { RSCContext } from "../types";

/**
 * Register a single action in the RSC context.
 */
export async function registerAction(
  ctx: RSCContext,
  id: string,
  fn: (...args: unknown[]) => unknown,
): Promise<void> {
  const registeredFn = registerServerReference(fn, id, id);
  ctx.actions.set(id, { fn: registeredFn as (...args: unknown[]) => unknown, id });
}

/**
 * Register multiple actions at once.
 */
export async function registerActions(
  ctx: RSCContext,
  actions: Record<string, (...args: unknown[]) => unknown>,
): Promise<void> {
  for (const [id, fn] of Object.entries(actions)) {
    const registeredFn = registerServerReference(fn, id, id);
    ctx.actions.set(id, { fn: registeredFn as (...args: unknown[]) => unknown, id });
  }
}

/**
 * Build action IDs from a module namespace.
 * Each function export becomes `${moduleId}#${exportName}`.
 */
export function createActionModuleMap(
  moduleId: string,
  moduleExports: Record<string, unknown>,
): Record<string, (...args: unknown[]) => unknown> {
  const actions: Record<string, (...args: unknown[]) => unknown> = {};
  for (const [exportName, value] of Object.entries(moduleExports)) {
    if (typeof value !== "function") {
      continue;
    }
    if (exportName.startsWith("__rscPrism")) {
      continue;
    }
    actions[`${moduleId}#${exportName}`] = value as (...args: unknown[]) => unknown;
  }
  return actions;
}

/**
 * Register all function exports from a module namespace as actions.
 */
export async function registerActionModule(
  ctx: RSCContext,
  moduleId: string,
  moduleExports: Record<string, unknown>,
): Promise<void> {
  await registerActions(ctx, createActionModuleMap(moduleId, moduleExports));
}
