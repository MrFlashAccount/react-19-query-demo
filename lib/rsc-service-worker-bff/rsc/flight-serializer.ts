/**
 * Custom RSC Flight Serializer for Service Worker
 *
 * This is a minimal implementation of the RSC wire format that works
 * in any JavaScript environment (including service workers).
 *
 * The wire format is a series of newline-delimited JSON rows:
 * - `0:{"type":"element",...}` - Root element
 * - `1:["$","div",null,{...}]` - Element reference
 * - `M1:{"id":"client","name":"Counter",...}` - Module reference
 *
 * @see https://github.com/facebook/react/blob/main/packages/react-server/src/ReactFlightServer.js
 */

import type { ReactNode, ReactElement } from "react";
import { isFragment } from "react-is";
import type { ClientManifest } from "./types";

type FlightValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | FlightValue[]
  | { [key: string]: FlightValue }
  | FlightElement
  | FlightModuleRef;

interface FlightElement {
  $$typeof: symbol;
  type: string | FlightModuleRef | ((...args: unknown[]) => unknown);
  key: string | null;
  props: Record<string, unknown>;
}

interface FlightModuleRef {
  $$typeof: symbol;
  name: string;
  id: string;
}

// React internal symbols
const REACT_ELEMENT_TYPE = Symbol.for("react.element");
const REACT_TRANSITIONAL_ELEMENT_TYPE = Symbol.for("react.transitional.element");
const REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");
const REACT_SERVER_REFERENCE = Symbol.for("react.server.reference");

// Flight encoding prefixes
const ELEMENT_PREFIX = "$";
const MODULE_PREFIX = "$L";
const FUNCTION_PREFIX = "$F";

/**
 * Server action registry - stores action functions by ID
 */
const serverActions = new Map<string, (...args: unknown[]) => unknown>();

/**
 * Create a server action reference that can be passed to client components
 *
 * @example
 * ```ts
 * const increment = createServerAction("increment", async (count: number) => count + 1);
 * // Pass to client component:
 * <Counter onIncrement={increment} />
 * ```
 */
export function createServerAction<T extends (...args: any[]) => any>(id: string, fn: T): T {
  serverActions.set(id, fn as (...args: unknown[]) => unknown);

  const ref = {
    $$typeof: REACT_SERVER_REFERENCE,
    $$id: id,
    $$bound: null,
  };

  return ref as unknown as T;
}

/**
 * Get a registered server action by ID
 */
export function getServerAction(id: string): ((...args: unknown[]) => unknown) | undefined {
  return serverActions.get(id);
}

/**
 * Execute a server action and return the result serialized as RSC
 */
export async function executeServerAction(
  actionId: string,
  args: unknown[],
  manifest: ClientManifest,
): Promise<Response> {
  const action = serverActions.get(actionId);
  if (!action) {
    return new Response(JSON.stringify({ error: `Action "${actionId}" not found` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await action(...args);
    // Serialize the result as an RSC stream
    return createFlightResponse(result as ReactNode, manifest);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Serialize a React element to RSC wire format (returns string)
 */
export function serializeToFlightPayload(element: ReactNode, manifest: ClientManifest): string {
  // Start module IDs from 1 to leave 0 for the root
  let moduleRowId = 1;
  const rows: string[] = [];
  const moduleRefs = new Map<string, number>();
  const actionRefs = new Map<string, number>();

  function getModuleRefId(moduleId: string, exportName: string): number {
    const key = `${moduleId}#${exportName}`;
    if (moduleRefs.has(key)) {
      return moduleRefs.get(key)!;
    }
    const id = moduleRowId++;
    moduleRefs.set(key, id);

    // Emit module row (I = import)
    // Format: I[moduleId, chunks, exportName] where chunks is an array of chunk IDs
    const manifestKey = exportName === "*" ? moduleId : `${moduleId}#${exportName}`;
    const entry = manifest[manifestKey];
    const modId = entry?.id ?? moduleId;
    const modName = entry?.name ?? exportName;
    const chunks = entry?.chunks ?? [];

    // Format: ["moduleId", [chunk1, chunk2, ...], "exportName"]
    rows.push(`${id}:I${JSON.stringify([modId, chunks, modName])}\n`);
    return id;
  }

  function getActionRefId(actionId: string): number {
    if (actionRefs.has(actionId)) {
      return actionRefs.get(actionId)!;
    }
    const id = moduleRowId++;
    actionRefs.set(actionId, id);

    // Emit server reference row
    // Format: {"id":"actionId","bound":null}
    rows.push(`${id}:{"id":"${actionId}","bound":null}\n`);
    return id;
  }

  function serializeValue(value: unknown): FlightValue {
    if (value === null || value === undefined) {
      return value as null | undefined;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(serializeValue);
    }

    if (typeof value === "object") {
      const obj = value as Record<string | symbol, unknown>;

      // Check for React element
      if (obj.$$typeof === REACT_ELEMENT_TYPE || obj.$$typeof === REACT_TRANSITIONAL_ELEMENT_TYPE) {
        return serializeElement(obj as unknown as ReactElement<Record<string, unknown>>);
      }

      // Check for server action reference
      if (obj.$$typeof === REACT_SERVER_REFERENCE) {
        const ref = obj as { $$id?: string };
        const actionId = ref.$$id ?? "";
        const refId = getActionRefId(actionId);
        // Server action reference: $F followed by the row ID
        return `${FUNCTION_PREFIX}${refId.toString(16)}` as unknown as FlightValue;
      }

      // Check for client reference (from createClientModuleProxy)
      if (obj.$$typeof === REACT_CLIENT_REFERENCE) {
        const ref = obj as { $$id?: string; name?: string };
        const id = ref.$$id ?? "";
        const name = ref.name ?? "*";
        const moduleId = id.includes("#") ? id.split("#")[0]! : id;
        const exportName = id.includes("#") ? id.split("#")[1]! : name;
        const refId = getModuleRefId(moduleId, exportName);
        return `${MODULE_PREFIX}${refId.toString(16)}` as unknown as FlightValue;
      }

      // Regular object
      const result: Record<string, FlightValue> = {};
      for (const key of Object.keys(obj)) {
        result[key] = serializeValue(obj[key]);
      }
      return result;
    }

    if (typeof value === "function") {
      // Check if it's a server action
      const fn = value as { $$typeof?: symbol; $$id?: string };
      if (fn.$$typeof === REACT_SERVER_REFERENCE) {
        const actionId = fn.$$id ?? "";
        const refId = getActionRefId(actionId);
        return `${FUNCTION_PREFIX}${refId.toString(16)}` as unknown as FlightValue;
      }

      // Server component - execute it
      const Component = value as (props: Record<string, unknown>) => ReactNode;
      return serializeValue(Component({}));
    }

    return null;
  }

  function serializeElement(element: ReactElement<Record<string, unknown>>): FlightValue {
    const { type, key, props } = element;

    // Handle fragments
    if (isFragment(type)) {
      const children = props.children;
      return serializeValue(children);
    }

    // Helper to serialize props
    function serializeProps(props: Record<string, unknown>): Record<string, FlightValue> {
      const serializedProps: Record<string, FlightValue> = {};
      for (const propKey of Object.keys(props)) {
        if (propKey !== "children") {
          serializedProps[propKey] = serializeValue(props[propKey]);
        }
      }
      if (props.children !== undefined) {
        serializedProps.children = serializeValue(props.children);
      }
      return serializedProps;
    }

    // Check if type is a client reference (object with $$typeof)
    if (typeof type === "object" && type !== null) {
      const ref = type as { $$typeof?: symbol; $$id?: string; name?: string };
      if (ref.$$typeof === REACT_CLIENT_REFERENCE) {
        const id = ref.$$id ?? "";
        const name = ref.name ?? "*";
        const moduleId = id.includes("#") ? id.split("#")[0]! : id;
        const exportName = id.includes("#") ? id.split("#")[1]! : name;
        const refId = getModuleRefId(moduleId, exportName);

        // Return element tuple: ["$", "$L<ref>", key, props]
        return [
          ELEMENT_PREFIX,
          `${MODULE_PREFIX}${refId.toString(16)}`,
          key,
          serializeProps(props),
        ] as FlightValue;
      }
    }

    // Handle server component (function type)
    if (typeof type === "function") {
      // Check if it's a client reference function
      const fn = type as { $$typeof?: symbol; $$id?: string; name?: string };
      if (fn.$$typeof === REACT_CLIENT_REFERENCE) {
        const id = fn.$$id ?? "";
        const name = fn.name ?? "*";
        const moduleId = id.includes("#") ? id.split("#")[0]! : id;
        const exportName = id.includes("#") ? id.split("#")[1]! : name;
        const refId = getModuleRefId(moduleId, exportName);

        // Return element tuple: ["$", "$L<ref>", key, props]
        return [
          ELEMENT_PREFIX,
          `${MODULE_PREFIX}${refId.toString(16)}`,
          key,
          serializeProps(props),
        ] as FlightValue;
      }

      // Server component - render it
      const rendered = (type as (props: Record<string, unknown>) => ReactNode)(props);
      return serializeValue(rendered);
    }

    // Handle intrinsic element (div, span, etc.)
    if (typeof type === "string") {
      // Return element tuple: ["$", "div", key, props]
      return [ELEMENT_PREFIX, type, key, serializeProps(props)] as FlightValue;
    }

    return null;
  }

  // Serialize the root element
  const rootValue = serializeValue(element);
  const rootRow = `0:${JSON.stringify(rootValue)}\n`;

  // Return all rows as a single string
  // Note: Module/import rows come first, then the root element row
  return [...rows, rootRow].join("");
}

/**
 * Serialize a React element to RSC wire format (returns ReadableStream)
 * @deprecated Use serializeToFlightPayload for better Safari compatibility
 */
export function serializeToFlightStream(
  element: ReactNode,
  manifest: ClientManifest,
): ReadableStream<Uint8Array> {
  const payload = serializeToFlightPayload(element, manifest);
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);

  let sent = false;
  return new ReadableStream({
    pull(controller) {
      if (!sent) {
        controller.enqueue(data);
        sent = true;
      }
      controller.close();
    },
  });
}

/**
 * Create a Response from a serialized RSC payload
 *
 * Uses string body instead of ReadableStream for Safari service worker compatibility.
 * Safari's service worker implementation doesn't properly handle ReadableStream
 * in Response constructor, resulting in "[object ReadableStream]" as body.
 */
export function createFlightResponse(
  element: ReactNode,
  manifest: ClientManifest,
  init?: ResponseInit,
): Response {
  const payload = serializeToFlightPayload(element, manifest);

  return new Response(payload, {
    ...init,
    headers: {
      "Content-Type": "text/x-component; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      ...init?.headers,
    },
  });
}
