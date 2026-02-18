const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
const SERVER_REFERENCE_SYMBOL = Symbol.for("react.server.reference");

export function annotateClientReference<T extends object>(
  reference: T,
  id: string,
): T & {
  $$typeof: symbol;
  $$id: string;
} {
  const value = reference as T & {
    $$typeof?: symbol;
    $$id?: string;
  };
  value.$$typeof = CLIENT_REFERENCE_SYMBOL;
  value.$$id = id;
  return value as T & {
    $$typeof: symbol;
    $$id: string;
  };
}

export function annotateServerReference<T extends (...args: any[]) => any>(
  reference: T,
  id: string,
): T & {
  $$typeof: symbol;
  $$id: string;
  $$bound: null;
} {
  const value = reference as T & {
    $$typeof?: symbol;
    $$id?: string;
    $$bound?: null;
  };
  value.$$typeof = SERVER_REFERENCE_SYMBOL;
  value.$$id = id;
  value.$$bound = null;
  return value as T & {
    $$typeof: symbol;
    $$id: string;
    $$bound: null;
  };
}

export function createClientModuleProxy(moduleId: string): Record<string, unknown> {
  const referencesByExportName = new Map<string, Record<string, unknown>>();
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key !== "string") {
          return undefined;
        }
        if (key === "__esModule") {
          return true;
        }
        const cached = referencesByExportName.get(key);
        if (cached != null) {
          return cached;
        }
        const created = annotateClientReference(
          {} as Record<string, unknown>,
          `${moduleId}#${key}`,
        );
        referencesByExportName.set(key, created);
        return created;
      },
    },
  );
}
