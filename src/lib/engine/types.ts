// Flow IR v1: the execution model. React Flow state is converted into this
// shape before validation/execution; rendering never drives semantics.

export const FLOW_SCHEMA_VERSION = "1.0";

export type Value = number | string | boolean | null | Value[];

export type NodeKind = "start" | "input" | "assign" | "decision" | "while" | "return";

export interface InputBinding {
  name: string;
  type: string;
}

export interface FlowNode {
  id: string;
  kind: NodeKind;
  data: {
    bindings?: InputBinding[];
    target?: string;
    expression?: string;
    condition?: string;
    label?: string;
  };
}

export interface FlowEdge {
  from: string;
  port: string;
  to: string;
}

export interface FlowGraph {
  schema_version: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const NODE_PORTS: Record<NodeKind, string[]> = {
  start: ["next"],
  input: ["next"],
  assign: ["next"],
  decision: ["true", "false"],
  while: ["body", "exit"],
  return: [],
};

export type ErrorCode =
  | "INVALID_GRAPH"
  | "PARSE_ERROR"
  | "UNDEFINED_VARIABLE"
  | "TYPE_MISMATCH"
  | "INDEX_OUT_OF_RANGE"
  | "DIVISION_BY_ZERO"
  | "UNKNOWN_FUNCTION"
  | "STEP_LIMIT_EXCEEDED"
  | "TIME_LIMIT_EXCEEDED"
  | "COLLECTION_LIMIT"
  | "INTEGER_OVERFLOW"
  | "MISSING_INPUT";

export class EngineError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public nodeId?: string,
  ) {
    super(message);
  }
}

export const LIMITS = {
  maxNodes: 150,
  maxEdges: 300,
  maxExpressionLength: 400,
  maxExpressionDepth: 48,
  maxCollectionSize: 200_000,
  maxStringLength: 200_000,
  maxSteps: 200_000,
  maxTraceEntries: 3_000,
  maxWallTimeMs: 2_000,
};
