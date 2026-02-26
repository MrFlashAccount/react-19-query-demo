/**
 * Actions module: server action registration, execution, and request handling.
 *
 * Colocated: constants, registry, request parsing, encode/decode reply, adapter.
 */

export { ACTION_HEADER_RSC, ACTION_HEADER_X_RSC } from "./constants";
export {
  registerAction,
  registerActions,
  createActionModuleMap,
  registerActionModule,
} from "./registry";
export { getActionIdFromRequest, isActionRequest, readEncodedActionArgs } from "./request";
export { decodeActionArgs } from "./decode";
export { executeAction, handleActionRows } from "./execute";
export { encodeReply } from "./encode-reply";
export { decodeReply } from "./decode-reply";
export {
  defaultFlightProtocolAdapter,
  type FlightProtocolAdapter,
  type FlightConsumeOptions,
} from "./adapter";
