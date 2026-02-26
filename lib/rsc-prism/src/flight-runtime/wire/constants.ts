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
export const CHR = {
  DOLLAR: 36, // '$'
  P: 80, // 'P' - URLSearchParams
  S: 83, // 'S' - Symbol
  C: 67, // 'C' - client reference
  K: 75, // 'K' - FormData
  F: 70, // 'F' - server reference
  L: 76, // 'L' - lazy chunk
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

/** Flight row kind discriminants; numeric for compact wire format and fast switch dispatch. */
export const ROW_MODEL = 0;
export const ROW_BINARY = 1;
export const ROW_DONE = 2;
export const ROW_ERROR = 3;
export const ROW_METADATA = 4;
