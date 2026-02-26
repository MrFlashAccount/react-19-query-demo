/**
 * Action request parsing: extract action ID and encoded args from HTTP requests.
 */

import type { EncodedActionArgs } from "../types";
import { ACTION_HEADER_RSC, ACTION_HEADER_X_RSC } from "./constants";

/**
 * Extract action ID from request headers (React convention).
 */
export function getActionIdFromRequest(request: Request): string | null {
  return request.headers.get(ACTION_HEADER_RSC) ?? request.headers.get(ACTION_HEADER_X_RSC) ?? null;
}

/**
 * Check if a request is an RSC action request.
 */
export function isActionRequest(request: Request): boolean {
  return getActionIdFromRequest(request) !== null;
}

/**
 * Read encoded action args from request body (FormData or text).
 */
export async function readEncodedActionArgs(request: Request): Promise<EncodedActionArgs> {
  const contentType = request.headers.get("Content-Type") ?? "";
  return contentType.includes("form")
    ? { type: "formdata", data: await request.formData() }
    : { type: "string", data: await request.text() };
}
