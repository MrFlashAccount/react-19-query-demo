/**
 * Action execution: run registered actions and optionally render results.
 */

import type { ReactNode } from "react";
import type { EncodedActionArgs, RSCContext, RSCRenderOptions } from "../types";
import type { FlightRowEmit } from "../flight-runtime/server";
import { flightDoneRow, flightModelRow } from "../flight-runtime/wire";
import { decodeActionArgs } from "./decode";

/**
 * Execute a registered action by ID with decoded args.
 */
export async function executeAction(
  ctx: RSCContext,
  actionId: string,
  encodedArgs: EncodedActionArgs,
): Promise<unknown> {
  const action = ctx.actions.get(actionId);
  if (!action) {
    const available = Array.from(ctx.actions.keys()).join(", ") || "(none)";
    throw new Error(`Action "${actionId}" not found. Available: ${available}`);
  }

  const args = await decodeActionArgs(encodedArgs);
  return action.fn(...args);
}

/**
 * Execute action and render its result as RSC rows.
 * Accepts renderer to avoid coupling actions to RSC render implementation.
 */
export async function handleActionRows(
  ctx: RSCContext,
  actionId: string,
  encodedArgs: EncodedActionArgs,
  renderRows: (
    element: ReactNode,
    ctx: RSCContext,
    emit: FlightRowEmit,
    options?: RSCRenderOptions,
  ) => Promise<void>,
  emit: FlightRowEmit,
  options?: RSCRenderOptions,
): Promise<void> {
  const result = await executeAction(ctx, actionId, encodedArgs);
  if (result === undefined) {
    emit(flightModelRow(0, undefined));
    emit(flightDoneRow());
    return;
  }
  await renderRows(result as ReactNode, ctx, emit, {
    onError: options?.onError,
    signal: options?.signal,
  });
}
