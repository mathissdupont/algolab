import { cloneValue, evaluate, resolveIndex, type Env } from "./evaluate";
import { EngineError, LIMITS, type ErrorCode, type FlowGraph, type Value } from "./types";
import { validateGraph, type CompiledGraph, type CompiledNode, type Issue } from "./validate";

export interface TraceEntry {
  step: number;
  nodeId: string;
  vars: Record<string, Value>;
  note?: string;
}

export interface RunError {
  code: ErrorCode;
  message: string;
  nodeId?: string;
}

export interface ExecutionResult {
  status: "ok" | "error";
  output?: Value;
  error?: RunError;
  issues?: Issue[];
  steps: number;
  trace: TraceEntry[];
  traceTruncated: boolean;
}

export interface ExecuteOptions {
  trace?: boolean;
  maxSteps?: number;
  maxTraceEntries?: number;
  timeLimitMs?: number;
  expectedInputs?: string[];
}

function snapshot(env: Env): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [k, v] of env) out[k] = cloneValue(v);
  return out;
}

function assign(c: CompiledNode, env: Env) {
  const target = c.target!;
  const expr = c.expr!;

  // `xs = append(xs, v)` is semantically a copy-then-replace; pushing in place
  // gives the same observable result without quadratic copying.
  if (
    target.indices.length === 0 &&
    expr.t === "call" &&
    expr.fn === "append" &&
    expr.args.length === 2 &&
    expr.args[0].t === "var" &&
    expr.args[0].name === target.name &&
    Array.isArray(env.get(target.name))
  ) {
    const arr = env.get(target.name) as Value[];
    if (arr.length >= LIMITS.maxCollectionSize) {
      throw new EngineError("COLLECTION_LIMIT", `Arrays are limited to ${LIMITS.maxCollectionSize} elements`);
    }
    arr.push(cloneValue(evaluate(expr.args[1], env)));
    return;
  }

  const value = evaluate(expr, env);
  if (target.indices.length === 0) {
    // Arrays have value semantics: assignment stores an independent copy.
    env.set(target.name, cloneValue(value));
    return;
  }
  if (!env.has(target.name)) {
    throw new EngineError("UNDEFINED_VARIABLE", `Variable '${target.name}' has not been assigned yet`);
  }
  let container: Value = env.get(target.name)!;
  for (let k = 0; k < target.indices.length; k++) {
    const idx = evaluate(target.indices[k], env);
    if (typeof container === "string") {
      throw new EngineError("TYPE_MISMATCH", "Strings cannot be changed in place; build a new string instead");
    }
    const i = resolveIndex(container, idx);
    const arr = container as Value[];
    if (k === target.indices.length - 1) arr[i] = cloneValue(value);
    else container = arr[i];
  }
}

/** Runs a validated graph. Execution is deterministic: same graph + input → same result. */
export function runCompiled(compiled: CompiledGraph, input: Record<string, Value>, opts: ExecuteOptions = {}): ExecutionResult {
  const maxSteps = opts.maxSteps ?? LIMITS.maxSteps;
  const maxTrace = opts.maxTraceEntries ?? LIMITS.maxTraceEntries;
  const timeLimit = opts.timeLimitMs ?? LIMITS.maxWallTimeMs;
  const started = Date.now();
  const env: Env = new Map();
  const trace: TraceEntry[] = [];
  let traceTruncated = false;
  let steps = 0;
  let current = compiled.startId;

  const record = (nodeId: string, note?: string) => {
    if (!opts.trace) return;
    if (trace.length >= maxTrace) {
      traceTruncated = true;
      return;
    }
    trace.push({ step: steps, nodeId, vars: snapshot(env), note });
  };

  for (;;) {
    const c = compiled.nodes.get(current)!;
    steps++;
    try {
      if (steps > maxSteps) {
        throw new EngineError("STEP_LIMIT_EXCEEDED", `Stopped after ${maxSteps.toLocaleString("en-US")} steps — is there an infinite loop?`);
      }
      if ((steps & 1023) === 0 && Date.now() - started > timeLimit) {
        throw new EngineError("TIME_LIMIT_EXCEEDED", `Stopped after ${timeLimit} ms`);
      }
      switch (c.node.kind) {
        case "start":
          record(current);
          current = c.next.next;
          break;
        case "input":
          for (const b of c.node.data.bindings ?? []) {
            if (!(b.name in input)) throw new EngineError("MISSING_INPUT", `Input '${b.name}' was not provided`);
            env.set(b.name, cloneValue(input[b.name]));
          }
          record(current);
          current = c.next.next;
          break;
        case "assign":
          assign(c, env);
          record(current);
          current = c.next.next;
          break;
        case "decision":
        case "while": {
          const v = evaluate(c.expr!, env);
          if (typeof v !== "boolean") {
            throw new EngineError("TYPE_MISMATCH", `Condition must be true or false, got ${v === null ? "null" : Array.isArray(v) ? "array" : typeof v}`);
          }
          const port = c.node.kind === "decision" ? (v ? "true" : "false") : v ? "body" : "exit";
          record(current, `condition is ${v} → ${port}`);
          current = c.next[port];
          break;
        }
        case "return": {
          const output = cloneValue(evaluate(c.expr!, env));
          record(current, "returned");
          return { status: "ok", output, steps, trace, traceTruncated };
        }
      }
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      if (opts.trace && trace.length < maxTrace) trace.push({ step: steps, nodeId: current, vars: snapshot(env), note: e.code });
      return {
        status: "error",
        error: { code: e.code, message: e.message, nodeId: e.nodeId ?? current },
        steps,
        trace,
        traceTruncated,
      };
    }
  }
}

export function execute(graph: FlowGraph, input: Record<string, Value>, opts: ExecuteOptions = {}): ExecutionResult {
  const v = validateGraph(graph, opts.expectedInputs);
  if (!v.ok || !v.compiled) {
    const first = v.errors[0];
    return {
      status: "error",
      error: { code: "INVALID_GRAPH", message: first?.message ?? "Invalid flowchart", nodeId: first?.nodeId },
      issues: v.errors,
      steps: 0,
      trace: [],
      traceTruncated: false,
    };
  }
  return runCompiled(v.compiled, input, opts);
}
