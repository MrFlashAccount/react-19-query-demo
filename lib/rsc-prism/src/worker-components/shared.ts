/**
 * Shared utilities for worker transport.
 */

let requestCounter = 0;

export function nextRequestId(): string {
  requestCounter += 1;
  return `rsc-${Date.now()}-${requestCounter}`;
}

export function toHeaderTuples(headers?: HeadersInit): [string, string][] {
  return [...new Headers(headers).entries()];
}

export function transferListForChunk(chunk: Uint8Array): Transferable[] | undefined {
  if (chunk.byteLength === 0) return undefined;
  const buffer = chunk.buffer;
  if (!(buffer instanceof ArrayBuffer)) return undefined;
  return [buffer];
}

export function concatUint8Chunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0];
  }
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

export function postMessageWithTransfer(
  target: { postMessage: (message: unknown, transfer?: Transferable[]) => void },
  message: unknown,
  transfer?: Transferable[],
): void {
  if (transfer != null && transfer.length > 0) {
    try {
      target.postMessage(message, transfer);
      return;
    } catch {
      // Some endpoints may not accept transfer lists in this environment.
    }
  }

  target.postMessage(message);
}

export function resolveReplyTarget(
  event: MessageEvent<unknown>,
): { postMessage: (message: unknown, transfer?: Transferable[]) => void } | null {
  const currentTarget = event.currentTarget as {
    postMessage?: (message: unknown, transfer?: Transferable[]) => void;
  } | null;
  if (currentTarget?.postMessage) {
    const target = currentTarget as {
      postMessage: (message: unknown, transfer?: Transferable[]) => void;
    };
    return {
      postMessage: (message, transfer) => postMessageWithTransfer(target, message, transfer),
    };
  }

  const globalTarget = globalThis as unknown as {
    postMessage?: (message: unknown, transfer?: Transferable[]) => void;
  };
  if (typeof globalTarget.postMessage === "function") {
    const target = globalTarget as {
      postMessage: (message: unknown, transfer?: Transferable[]) => void;
    };
    return {
      postMessage: (message, transfer) => postMessageWithTransfer(target, message, transfer),
    };
  }

  return null;
}
