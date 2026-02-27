/**
 * Flight wire format constants.
 *
 * Uses numeric char codes instead of string comparisons in hot paths to avoid
 * V8 deoptimization from polymorphic string operations.
 */
import {
  CLIENT_REFERENCE_SYMBOL,
  SERVER_REFERENCE_SYMBOL,
} from "../../module-references/constants";

/** ASCII char codes for Flight wire format prefixes ($X) */
export const CHR_CODES = {
  ELEMENT_PREFIX: 36, // '$'
  P: 80, // 'P' - URLSearchParams
  S: 83, // 'S' - Symbol
  R: 82, // 'R' - client reference
  K: 75, // 'K' - FormData
  F: 70, // 'F' - server reference
  L: 76, // 'L' - lazy chunk
} as const;

export const CHR = {
  ELEMENT_PREFIX: String.fromCharCode(CHR_CODES.ELEMENT_PREFIX),
  P: String.fromCharCode(CHR_CODES.P),
  S: String.fromCharCode(CHR_CODES.S),
  R: String.fromCharCode(CHR_CODES.R),
  K: String.fromCharCode(CHR_CODES.K),
  F: String.fromCharCode(CHR_CODES.F),
  L: String.fromCharCode(CHR_CODES.L),
} as const;

export const CHR_PREFIXES = {
  CLIENT_REFERENCE: `${CHR.ELEMENT_PREFIX}${CHR.R}`,
  SERVER_REFERENCE: `${CHR.ELEMENT_PREFIX}${CHR.F}`,
  LAZY_CHUNK: `${CHR.ELEMENT_PREFIX}${CHR.L}`,
  FORM_DATA: `${CHR.ELEMENT_PREFIX}${CHR.K}`,
  URL_SEARCH_PARAMS: `${CHR.ELEMENT_PREFIX}${CHR.P}`,
  SYMBOL: `${CHR.ELEMENT_PREFIX}${CHR.S}`,
} as const;

export { CLIENT_REFERENCE_SYMBOL, SERVER_REFERENCE_SYMBOL };
export const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
export const LEGACY_REACT_ELEMENT_SYMBOL = Symbol.for("react.element");
export const REACT_FRAGMENT_SYMBOL = Symbol.for("react.fragment");
export const REACT_LAZY_SYMBOL = Symbol.for("react.lazy");

/**
 * Special path key meaning "all array indices at this level".
 * Used when many array elements share the same revive subtree to avoid O(n) path entries.
 */
export const REVIVE_PATH_WILDCARD = -1;

/** Shared empty array to avoid allocations in decode hot paths. */
export const EMPTY_ARRAY = [] as const;

/** Wire tagged value type IDs: compact [typeId, payload] instead of { $t, ... }. */
export const WIRE_TAG = {
  SEARCH: 3,
  FORMDATA: 4,
  ROW_REF: 7,
  CLIENT_REF: 8,
  SERVER_REF: 9,
  ELEMENT: 10,
  HOST: 11,
  FRAGMENT: 12,
} as const;

/** Sentinel for compact wire format; first element of tagged arrays. Unlikely in normal data. */
export const WIRE_TAG_SENTINEL = "\0";

/** Flight row kind discriminants; numeric for compact wire format and fast switch dispatch. */
export const ROW_MODEL = 0;
export const ROW_BINARY = 1;
export const ROW_DONE = 2;
export const ROW_ERROR = 3;
export const ROW_METADATA = 4;
