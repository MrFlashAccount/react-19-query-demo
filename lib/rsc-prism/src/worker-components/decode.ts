/**
 * Worker transport message normalization and parsing.
 */

import type { FlightRowMessage } from "../flight-runtime/wire";
import type {
  WorkerTransportRequestMessage,
  WorkerRefreshTargetMessage,
  WorkerActionRefreshBatchMessage,
  WorkerActionRefreshBatchEntryMessage,
} from "./types";

export interface NormalizedWorkerRowMessage {
  matchedType: boolean;
  rows: FlightRowMessage[];
  actionRefreshBatch: WorkerActionRefreshBatchMessage | null;
}

export function normalizeWorkerRowMessage(
  data: unknown,
  rowResponseType: string,
): NormalizedWorkerRowMessage {
  const message = data as Record<string, unknown> | null;
  if (message == null || message.type !== rowResponseType) {
    return {
      matchedType: false,
      rows: [],
      actionRefreshBatch: null,
    };
  }
  const rows = Array.isArray(message.rows) ? (message.rows as FlightRowMessage[]) : [];
  const actionRefreshBatch = normalizeActionRefreshBatchMessage(message.actionRefreshBatch);
  return {
    matchedType: true,
    rows,
    actionRefreshBatch,
  };
}

export function normalizeRefreshTargetMessage(target: unknown): WorkerRefreshTargetMessage | null {
  if (typeof target !== "object" || target == null) {
    return null;
  }
  const candidate = target as Record<string, unknown>;
  if (typeof candidate.targetKey !== "string" || typeof candidate.componentId !== "string") {
    return null;
  }
  return {
    targetKey: candidate.targetKey,
    componentId: candidate.componentId,
    componentProps: candidate.componentProps,
  };
}

export function normalizeActionRefreshBatchMessage(
  batch: unknown,
): WorkerActionRefreshBatchMessage | null {
  if (typeof batch !== "object" || batch == null) {
    return null;
  }
  const candidate = batch as Record<string, unknown>;
  if (!Number.isFinite(candidate.seq as number) || !Array.isArray(candidate.entries)) {
    return null;
  }

  const entries: WorkerActionRefreshBatchEntryMessage[] = [];
  for (let i = 0; i < candidate.entries.length; i += 1) {
    const rawEntry = candidate.entries[i];
    if (typeof rawEntry !== "object" || rawEntry == null) {
      continue;
    }
    const entry = rawEntry as Record<string, unknown>;
    if (typeof entry.targetKey !== "string") {
      continue;
    }
    const normalizedEntry: WorkerActionRefreshBatchEntryMessage = {
      targetKey: entry.targetKey,
      rows: Array.isArray(entry.rows) ? (entry.rows as FlightRowMessage[]) : undefined,
      error: typeof entry.error === "string" ? entry.error : undefined,
    };
    entries.push(normalizedEntry);
  }

  return {
    seq: Math.trunc(candidate.seq as number),
    entries,
  };
}

export function normalizeIncomingWorkerTransportRequest(
  data: unknown,
  requestType: string,
): WorkerTransportRequestMessage | null {
  const message = data as Record<string, unknown> | null;
  if (message == null || message.type !== requestType || typeof message.id !== "string") {
    return null;
  }
  const operation = message.operation;
  if (operation !== "action" && operation !== "fetch") {
    return null;
  }
  return {
    type: requestType,
    id: message.id,
    operation,
    actionId: typeof message.actionId === "string" ? message.actionId : undefined,
    contentType: typeof message.contentType === "string" ? message.contentType : undefined,
    body: (message.body as BodyInit | undefined) ?? undefined,
    componentId: typeof message.componentId === "string" ? message.componentId : undefined,
    componentProps: message.componentProps,
    refreshTargets: Array.isArray(message.refreshTargets)
      ? message.refreshTargets
          .map((target) => normalizeRefreshTargetMessage(target))
          .filter((target): target is WorkerRefreshTargetMessage => target != null)
      : undefined,
    refreshBatchSeq:
      typeof message.refreshBatchSeq === "number" && Number.isFinite(message.refreshBatchSeq)
        ? Math.trunc(message.refreshBatchSeq)
        : undefined,
  };
}
