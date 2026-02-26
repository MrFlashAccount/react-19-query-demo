/**
 * Standalone worker runtime bootstrap.
 *
 * For manual/standalone use when not using the Vite plugin. The plugin
 * generates equivalent inline code. PostMessage-only, no Request/Response.
 */

import { encodedArgsFromMessage } from "../actions";
import { createWorkerRowHandler } from "../server";
import { createWorkerRowTransportMessageHandler } from "./handler";
import type { WorkerActionRefreshBatchEntryMessage, WorkerTransportRequestMessage } from "./types";
import type { ReactNode } from "react";
import {
  flightDoneRow,
  flightErrorRow,
  ROW_DONE,
  ROW_ERROR,
  type FlightRowMessage,
} from "../flight-runtime/wire";

interface WorkerRuntimeModuleConfig {
  moduleId: string;
  moduleExports: Record<string, unknown>;
}

export interface CreateWorkerRuntimeOptions {
  componentModules: WorkerRuntimeModuleConfig[];
  actionModules?: WorkerRuntimeModuleConfig[];
  actionBatchRefresh?: boolean;
}

function buildComponentRegistry(
  modules: WorkerRuntimeModuleConfig[],
): Map<string, (props: unknown) => unknown> {
  const registry = new Map<string, (props: unknown) => unknown>();
  for (const moduleConfig of modules) {
    for (const [exportName, value] of Object.entries(moduleConfig.moduleExports)) {
      if (typeof value !== "function") {
        continue;
      }
      registry.set(`${moduleConfig.moduleId}#${exportName}`, value as (props: unknown) => unknown);
    }
  }
  return registry;
}

export async function createWorkerRuntime(options: CreateWorkerRuntimeOptions): Promise<void> {
  const componentRegistry = buildComponentRegistry(options.componentModules);
  const actionBatchRefreshEnabled = options.actionBatchRefresh === true;
  const handler = await createWorkerRowHandler({
    actionModules: options.actionModules ?? [],
  });

  async function renderRowsToArray(element: ReactNode): Promise<FlightRowMessage[]> {
    const rows: FlightRowMessage[] = [];
    await handler.renderRows(element, (row) => {
      rows.push(row);
    });
    return rows;
  }

  function splitTerminalRow(rows: FlightRowMessage[]): {
    contentRows: FlightRowMessage[];
    terminalRow: FlightRowMessage;
  } {
    const lastRow = rows[rows.length - 1];
    if (lastRow != null && (lastRow.k === ROW_DONE || lastRow.k === ROW_ERROR)) {
      return {
        contentRows: rows.slice(0, -1),
        terminalRow: lastRow,
      };
    }
    return {
      contentRows: rows,
      terminalRow: flightDoneRow(),
    };
  }

  self.addEventListener(
    "message",
    createWorkerRowTransportMessageHandler(
      async (request: WorkerTransportRequestMessage, emit, controls) => {
        if (request.operation === "fetch") {
          if (!request.componentId) {
            emit(flightErrorRow("Missing component ID"));
            return;
          }
          const component = componentRegistry.get(request.componentId);

          if (component == null) {
            emit(flightErrorRow("Missing or unknown worker component reference."));
            return;
          }

          await handler.renderRows(component(request.componentProps ?? {}) as ReactNode, emit);
          return;
        }

        if (request.operation === "action") {
          const refreshTargets = request.refreshTargets ?? [];
          const actionId = request.actionId;
          const encodedArgs = encodedArgsFromMessage(request);
          if (!actionId) {
            emit(flightErrorRow("Missing action ID"));
            return;
          }
          if (!actionBatchRefreshEnabled || refreshTargets.length === 0) {
            await handler.handleActionRows(actionId, encodedArgs, emit);
            return;
          }

          try {
            const actionValue = await handler.executeAction(actionId, encodedArgs);
            const actionRows = await renderRowsToArray(actionValue as ReactNode);
            const { contentRows, terminalRow } = splitTerminalRow(actionRows);

            const batchEntries: WorkerActionRefreshBatchEntryMessage[] = [];
            for (let i = 0; i < refreshTargets.length; i += 1) {
              const refreshTarget = refreshTargets[i];
              const refreshComponent = componentRegistry.get(refreshTarget.componentId);
              if (refreshComponent == null) {
                batchEntries.push({
                  targetKey: refreshTarget.targetKey,
                  error: `Missing or unknown worker component reference: ${refreshTarget.componentId}`,
                });
                continue;
              }

              try {
                const refreshRows = await renderRowsToArray(
                  refreshComponent(refreshTarget.componentProps ?? {}) as ReactNode,
                );
                batchEntries.push({
                  targetKey: refreshTarget.targetKey,
                  rows: refreshRows,
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                batchEntries.push({
                  targetKey: refreshTarget.targetKey,
                  error: message,
                });
              }
            }

            controls.setActionRefreshBatch({
              seq: request.refreshBatchSeq ?? 0,
              entries: batchEntries,
            });
            for (let i = 0; i < contentRows.length; i += 1) {
              emit(contentRows[i]);
            }
            emit(terminalRow);
            return;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            emit(flightErrorRow(message));
            return;
          }
        }

        emit(flightErrorRow("Unsupported operation"));
      },
    ),
  );

  self.postMessage({ type: "rsc.prism.worker.ready" });
}
