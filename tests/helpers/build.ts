// Test helper: compiles structured pseudo-code into a Flow IR graph so
// fixtures stay readable. Not used by the app.

import { FLOW_SCHEMA_VERSION, type FlowEdge, type FlowGraph, type FlowNode } from "../../src/lib/engine/types";

export type Stmt =
  | { set: string; to: string }
  | { if: string; then: Stmt[]; else?: Stmt[] }
  | { while: string; do: Stmt[] }
  | { ret: string };

export function buildGraph(inputs: string[], body: Stmt[]): FlowGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let n = 0;
  const id = (p: string) => `${p}${++n}`;

  const emitList = (stmts: Stmt[], follow: string | null): string | null => {
    for (let i = stmts.length - 1; i >= 0; i--) follow = emit(stmts[i], follow);
    return follow;
  };
  const link = (from: string, port: string, to: string | null) => {
    if (!to) throw new Error(`dangling '${port}' from ${from}`);
    edges.push({ from, port, to });
  };
  const emit = (s: Stmt, follow: string | null): string => {
    if ("set" in s) {
      const nid = id("assign");
      nodes.push({ id: nid, kind: "assign", data: { target: s.set, expression: s.to } });
      link(nid, "next", follow);
      return nid;
    }
    if ("ret" in s) {
      const nid = id("return");
      nodes.push({ id: nid, kind: "return", data: { expression: s.ret } });
      return nid;
    }
    if ("if" in s) {
      const nid = id("decision");
      nodes.push({ id: nid, kind: "decision", data: { condition: s.if } });
      link(nid, "true", emitList(s.then, follow));
      link(nid, "false", emitList(s.else ?? [], follow));
      return nid;
    }
    const nid = id("while");
    nodes.push({ id: nid, kind: "while", data: { condition: s.while } });
    link(nid, "body", emitList(s.do, nid));
    link(nid, "exit", follow);
    return nid;
  };

  const first = emitList(body, null);
  nodes.push({ id: "start", kind: "start", data: {} });
  nodes.push({ id: "input", kind: "input", data: { bindings: inputs.map((name) => ({ name, type: "any" })) } });
  link("start", "next", "input");
  link("input", "next", first);
  return { schema_version: FLOW_SCHEMA_VERSION, nodes, edges };
}
