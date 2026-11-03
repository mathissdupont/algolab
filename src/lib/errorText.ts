import type { ErrorCode } from "./engine/types";

/** Plain-language headline for each engine error; the code stays available as detail. */
export const ERROR_TITLE: Record<ErrorCode, string> = {
  INVALID_GRAPH: "The flowchart isn’t complete yet",
  PARSE_ERROR: "An expression can’t be read",
  UNDEFINED_VARIABLE: "A variable is used before it has a value",
  TYPE_MISMATCH: "Two values don’t fit together",
  INDEX_OUT_OF_RANGE: "An index points outside the array",
  KEY_NOT_FOUND: "A key isn’t in the map",
  DIVISION_BY_ZERO: "The run divided by zero",
  UNKNOWN_FUNCTION: "A function name isn’t recognised",
  STEP_LIMIT_EXCEEDED: "The run never finished",
  TIME_LIMIT_EXCEEDED: "The run took too long",
  COLLECTION_LIMIT: "An array or text grew too large",
  INTEGER_OVERFLOW: "A number grew too large",
  MISSING_INPUT: "An input value is missing",
};
