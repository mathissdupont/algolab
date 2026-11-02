import { collectVariables, parseExpression, parseTarget, type AssignTarget, type Expr } from "./expression";
import { EngineError, FLOW_SCHEMA_VERSION, LIMITS, NODE_PORTS, type FlowGraph, type FlowNode, type NodeKind } from "./types";

export interface Issue {
  nodeId?: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}

export interface CompiledNode {
  node: FlowNode;
  expr?: Expr;
  target?: AssignTarget;
  next: Record<string, string>;
}

export interface CompiledGraph {
  startId: string;
  nodes: Map<string, CompiledNode>;
}

const KIND_LABEL: Record<NodeKind, string> = {
  start: "Start",
  input: "Input",
  assign: "Assign",
  decision: "Decision",
  while: "While",
  return: "Return",
};

function describe(n: FlowNode): string {
  return n.data.label?.trim() ? `${KIND_LABEL[n.kind]} "${n.data.label.trim()}"` : KIND_LABEL[n.kind];
}

/**
 * Structural + static validation. Produces a compiled graph (parsed
 * expressions, resolved ports) only when there are no errors.
 */
export function validateGraph(
  graph: FlowGraph,
  expectedInputs?: string[],
): ValidationResult & { compiled?: CompiledGraph } {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (message: string, nodeId?: string) => errors.push({ message, nodeId });

  if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return { ok: false, errors: [{ message: "Flowchart payload is malformed" }], warnings };
  }
  if (graph.schema_version !== FLOW_SCHEMA_VERSION) {
    err(`Unsupported flowchart schema version '${graph.schema_version}' (expected ${FLOW_SCHEMA_VERSION})`);
  }
  if (graph.nodes.length > LIMITS.maxNodes) err(`Flowcharts are limited to ${LIMITS.maxNodes} nodes`);
  if (graph.edges.length > LIMITS.maxEdges) err(`Flowcharts are limited to ${LIMITS.maxEdges} connections`);
  if (errors.length) return { ok: false, errors, warnings };

  const byId = new Map<string, FlowNode>();
  for (const n of graph.nodes) {
    if (!n || typeof n.id !== "string" || !(n.kind in NODE_PORTS)) {
      err(`Node ${JSON.stringify(n?.id)} has an unknown type`);
      continue;
    }
    if (byId.has(n.id)) err(`Duplicate node id '${n.id}'`, n.id);
    byId.set(n.id, { ...n, data: n.data ?? {} });
  }

  const starts = [...byId.values()].filter((n) => n.kind === "start");
  if (starts.length !== 1) err(starts.length === 0 ? "The flowchart needs a Start node" : "Only one Start node is allowed");
  const inputs = [...byId.values()].filter((n) => n.kind === "input");
  if (inputs.length > 1) err("Only one Input node is allowed");
  if (expectedInputs && expectedInputs.length > 0 && inputs.length === 0) err("The flowchart needs an Input node to read the problem input");
  if (![...byId.values()].some((n) => n.kind === "return")) err("The flowchart needs at least one Return node");

  // Edges and ports.
  const next = new Map<string, Record<string, string>>();
  const preds = new Map<string, string[]>();
  for (const id of byId.keys()) {
    next.set(id, {});
    preds.set(id, []);
  }
  for (const e of graph.edges) {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from || !to) {
      err(`A connection points to a missing node (${e.from} → ${e.to})`);
      continue;
    }
    if (!NODE_PORTS[from.kind].includes(e.port)) {
      err(`${describe(from)} has no '${e.port}' output`, from.id);
      continue;
    }
    if (to.kind === "start") {
      err("Nothing can connect into the Start node", to.id);
      continue;
    }
    if (from.id === to.id) {
      err(`${describe(from)} cannot connect to itself`, from.id);
      continue;
    }
    const ports = next.get(from.id)!;
    if (ports[e.port]) {
      err(`${describe(from)} has more than one '${e.port}' connection`, from.id);
      continue;
    }
    ports[e.port] = to.id;
    preds.get(to.id)!.push(from.id);
  }
  for (const n of byId.values()) {
    for (const port of NODE_PORTS[n.kind]) {
      if (!next.get(n.id)![port]) err(`${describe(n)} needs a '${port}' connection`, n.id);
    }
  }

  // Expressions.
  const compiled = new Map<string, CompiledNode>();
  for (const n of byId.values()) {
    const c: CompiledNode = { node: n, next: next.get(n.id)! };
    try {
      if (n.kind === "assign") {
        if (!n.data.target?.trim()) throw new EngineError("PARSE_ERROR", "Target variable is empty");
        c.target = parseTarget(n.data.target.trim());
        c.expr = parseExpression(n.data.expression ?? "");
      } else if (n.kind === "decision" || n.kind === "while") {
        c.expr = parseExpression(n.data.condition ?? "");
      } else if (n.kind === "return") {
        c.expr = parseExpression(n.data.expression ?? "");
      } else if (n.kind === "input") {
        const names = (n.data.bindings ?? []).map((b) => b.name);
        if (expectedInputs) {
          const missing = expectedInputs.filter((x) => !names.includes(x));
          if (missing.length) err(`Input node must bind: ${missing.join(", ")}`, n.id);
        }
      }
    } catch (e) {
      const where = n.kind === "assign" && !c.target ? "target" : n.kind === "decision" || n.kind === "while" ? "condition" : "expression";
      err(`${describe(n)} ${where}: ${(e as Error).message}`, n.id);
    }
    compiled.set(n.id, c);
  }

  if (errors.length || starts.length !== 1) return { ok: false, errors, warnings };
  const startId = starts[0].id;

  // Reachability.
  const reachable = new Set<string>();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    Object.values(next.get(id)!).forEach((t) => stack.push(t));
  }
  for (const n of byId.values()) {
    if (!reachable.has(n.id)) err(`${describe(n)} is not reachable from Start`, n.id);
  }
  if (![...reachable].some((id) => byId.get(id)!.kind === "return")) err("No Return node can be reached from Start");

  // Every While body must be able to come back to its While node.
  for (const n of byId.values()) {
    if (n.kind !== "while") continue;
    const seen = new Set<string>();
    const todo = [next.get(n.id)!.body];
    let loops = false;
    while (todo.length && !loops) {
      const id = todo.pop()!;
      if (id === n.id) loops = true;
      if (seen.has(id)) continue;
      seen.add(id);
      Object.values(next.get(id)!).forEach((t) => todo.push(t));
    }
    if (!loops) err(`${describe(n)}: the 'body' path never leads back to this While node`, n.id);
  }

  if (errors.length) return { ok: false, errors, warnings };

  // Definite assignment: a variable must be assigned on every path before use.
  const defsOf = (id: string): string[] => {
    const c = compiled.get(id)!;
    if (c.node.kind === "input") return (c.node.data.bindings ?? []).map((b) => b.name);
    if (c.node.kind === "assign" && c.target && c.target.indices.length === 0) return [c.target.name];
    return [];
  };
  const order = [...reachable];
  const outSets = new Map<string, Set<string> | null>(order.map((id) => [id, null])); // null = TOP
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of order) {
      let inSet: Set<string> | null;
      if (id === startId) inSet = new Set();
      else {
        inSet = null as Set<string> | null;
        for (const p of preds.get(id)!) {
          if (!reachable.has(p)) continue;
          const po = outSets.get(p)!;
          if (po === null) continue;
          inSet = inSet === null ? new Set(po) : new Set([...inSet].filter((x) => po.has(x)));
        }
      }
      if (inSet === null) continue;
      const out = new Set([...inSet, ...defsOf(id)]);
      const prev = outSets.get(id)!;
      if (prev === null || prev.size !== out.size) {
        outSets.set(id, out);
        changed = true;
      }
    }
  }
  for (const id of order) {
    const c = compiled.get(id)!;
    const used = new Set<string>();
    if (c.expr) collectVariables(c.expr, used);
    if (c.target && c.target.indices.length) {
      used.add(c.target.name);
      c.target.indices.forEach((ix) => collectVariables(ix, used));
    }
    if (!used.size) continue;
    const available = id === startId ? new Set<string>() : intersectPreds(id, preds, reachable, outSets);
    for (const v of used) {
      if (!available.has(v)) {
        err(`${describe(c.node)}: '${v}' may be used before it is assigned on some path`, id);
      }
    }
  }

  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, errors, warnings, compiled: { startId, nodes: compiled } };
}

function intersectPreds(
  id: string,
  preds: Map<string, string[]>,
  reachable: Set<string>,
  outSets: Map<string, Set<string> | null>,
): Set<string> {
  let acc = null as Set<string> | null;
  for (const p of preds.get(id)!) {
    if (!reachable.has(p)) continue;
    const po = outSets.get(p);
    if (!po) continue;
    acc = acc === null ? new Set(po) : new Set([...acc].filter((x) => po.has(x)));
  }
  return acc ?? new Set();
}
