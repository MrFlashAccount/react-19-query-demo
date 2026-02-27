/**
 * Wire encode/decode API — re-exports from wire/ for backward compatibility.
 * New code should import from "./wire" or "./wire/index" directly.
 * @see ./wire/index.ts
 */
export {
  REACT_LAZY_SYMBOL,
  REVIVE_PATH_WILDCARD,
  ROW_BINARY,
  ROW_DONE,
  ROW_ERROR,
  ROW_METADATA,
  ROW_MODEL,
  rehydrateArrayBuffer,
  rehydrateTypedArray,
  decodeBinaryWireRow,
  binaryWireTagFromKind,
  isBinaryWireRowTag,
  escapeStringValue,
  encodeStreamType,
  encodeStreamValue,
  encodeWireValue,
  encodeWireValueWithBinaryRows,
  parseModelString,
  createModelReviver,
  reviveModelValueTree,
  traverseElementTuplesOnly,
  createLazyChunkWrapper,
  createServerReference,
  applyDirectPathReplacements,
  decodeWireValue,
  pathsToTree,
  pushPathToTree,
  finalizePathTree,
  flightModelRow,
  flightMetadataRow,
  flightBinaryRow,
  flightDoneRow,
  flightErrorRow,
} from "./wire/index";
export type {
  RevivePathTree,
  MutablePathTree,
  StreamEncodeContext,
  StreamDecodeContext,
  FlightRowMessage,
  FlightTemplateRowShape,
} from "./wire/index";
