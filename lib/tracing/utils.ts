export function noop(): void {
  // No-op
}

export function noopCallback(): () => void {
  return noop;
}

const requestIdleCallbackFn =
  typeof requestIdleCallback === "function" ? requestIdleCallback : setTimeout;
export function requestIdleCallback(callback: () => void): void {
  requestIdleCallbackFn(callback);
}

export function serializePayload(
  payload: Record<string, unknown> | undefined | null
): string {
  if (payload === undefined || payload === null) {
    return "";
  }

  return JSON.stringify(payload, (_, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Error) {
      return {
        message: value.message,
        stack: value.stack,
        name: value.name,
      };
    }

    if (value instanceof Promise) {
      return "<Promise>";
    }

    if (value instanceof Set) {
      return Array.from(value);
    }

    if (value instanceof Map) {
      return Object.fromEntries(value);
    }

    if (typeof value === "symbol") {
      return `Symbol(${value.toString()})`;
    }

    if (typeof value === "function") {
      return `Function:${value.name ?? "anonymous"}`;
    }

    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, value]) => [
          key,
          serializePayload(value as Record<string, unknown>),
        ])
      );
    }

    return value;
  });
}
