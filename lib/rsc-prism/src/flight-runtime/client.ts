import { MAIN_THREAD_MODULES_GLOBAL_KEY } from "../runtime-globals";
import type { FlightClientOptions } from "./types";
import { decodeWireValue, encodeWireValue } from "./wire";

function getMainThreadModules(): Record<string, Record<string, unknown>> {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  const modules = globalState[MAIN_THREAD_MODULES_GLOBAL_KEY];
  if (typeof modules !== "object" || modules == null) {
    return {};
  }
  return modules as Record<string, Record<string, unknown>>;
}

function resolveClientReferenceById(id: string): unknown {
  const hashIndex = id.lastIndexOf("#");
  const moduleId = hashIndex === -1 ? id : id.slice(0, hashIndex);
  const exportName = hashIndex === -1 ? "default" : id.slice(hashIndex + 1);
  const modules = getMainThreadModules();
  const moduleExports = modules[moduleId];
  if (moduleExports == null) {
    throw new Error(`[rsc-prism] Unknown client module "${moduleId}" in minimal Flight runtime.`);
  }
  if (exportName === "*") {
    return moduleExports;
  }
  if (!(exportName in moduleExports)) {
    throw new Error(`[rsc-prism] Unknown client export "${id}" in minimal Flight runtime.`);
  }
  return moduleExports[exportName];
}

async function readText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function parseFlightPayload(payload: string): unknown {
  const lines = payload
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const row = lines.find((line) => line.startsWith("0:")) ?? lines[0];
  if (row == null) {
    return null;
  }
  const json = row.startsWith("0:") ? row.slice(2) : row;
  return JSON.parse(json);
}

export async function createFromReadableStream<T>(
  stream: ReadableStream<Uint8Array>,
  _options?: FlightClientOptions,
): Promise<T> {
  const payload = await readText(stream);
  const parsed = parseFlightPayload(payload);
  return decodeWireValue(parsed, resolveClientReferenceById) as T;
}

export async function encodeReply(value: unknown): Promise<FormData | string> {
  return JSON.stringify(encodeWireValue(value));
}
