/**
 * Flight wire encode/decode API.
 *
 * Public surface for the wire module. Internal structure: constants, types,
 * shared, binary, encode, decode, path-tree, rows.
 */
export {
  REACT_LAZY_SYMBOL,
  REVIVE_PATH_WILDCARD,
  ROW_BINARY,
  ROW_DONE,
  ROW_ERROR,
  ROW_METADATA,
  ROW_MODEL,
} from "./constants";
export {
  rehydrateArrayBuffer,
  rehydrateTypedArray,
  decodeBinaryWireRow,
  binaryWireTagFromKind,
  isBinaryWireRowTag,
} from "./binary";
export {
  escapeStringValue,
  encodeStreamType,
  encodeStreamValue,
  encodeWireValue,
  encodeWireValueWithBinaryRows,
} from "./encode";
export type { WireEncodeOptions } from "./encode";
export {
  parseModelString,
  createModelReviver,
  reviveModelValueTree,
  traverseElementTuplesOnly,
  createLazyChunkWrapper,
  createServerReference,
  applyDirectPathReplacements,
  decodeWireValue,
} from "./decode";
export { pathsToTree, pushPathToTree, finalizePathTree } from "./path-tree";
export type { RevivePathTree, MutablePathTree } from "./path-tree";
export {
  flightModelRow,
  flightMetadataRow,
  flightBinaryRow,
  flightDoneRow,
  flightErrorRow,
} from "./rows";
export type {
  StreamEncodeContext,
  StreamDecodeContext,
  FlightRowMessage,
  FlightTemplateRowShape,
} from "./types";
