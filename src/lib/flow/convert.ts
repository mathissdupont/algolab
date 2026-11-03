// Bridges the editor (React Flow nodes/edges with positions and UI flags)
// and the execution model (Flow IR). Only semantic fields cross over.

import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { FLOW_SCHEMA_VERSION, type FlowGraph, type InputBinding, type NodeKind } from "../engine/types";
import { inputNames, schemaLabel, type Problem } from "../problems";

export interface FlowNodeData extends Record<string, unknown> {
  kind: NodeKind;
  target?: string;
  expression?: string;
  condition?: string;
  bindings?: InputBinding[];
  label?: string;
  breakpoint?: boolean;
  // transient UI state, never saved
  active?: boolean;
  hasError?: boolean;
}

export type RFNode = Node<FlowNodeData>;
export type RFEdge = Edge;

export interface Draft {
  nodes: RFNode[];
  edges: RFEdge[];
}

// Branch ports are labelled on the node handles, so edges stay neutral.
export function makeEdge(source: string, port: string, target: string, targetHandle?: string | null): RFEdge {
  return {
    id: `e-${source}-${port}-${target}-${Math.random().toString(36).slice(2, 7)}`,
    source,
    sourceHandle: port,
    target,
    targetHandle: targetHandle ?? undefined,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  };
}

export function toIR(nodes: RFNode[], edges: RFEdge[]): FlowGraph {
  return {
    schema_version: FLOW_SCHEMA_VERSION,
    nodes: nodes.map((n) => {
      const d = n.data;
      const data: FlowGraph["nodes"][number]["data"] = {};
      if (d.label) data.label = d.label;
      if (d.kind === "assign") {
        data.target = d.target ?? "";
        data.expression = d.expression ?? "";
      } else if (d.kind === "decision" || d.kind === "while") {
        data.condition = d.condition ?? "";
      } else if (d.kind === "return") {
        data.expression = d.expression ?? "";
      } else if (d.kind === "input") {
        data.bindings = d.bindings ?? [];
      }
      return { id: n.id, kind: d.kind, data };
    }),
    edges: edges.map((e) => ({ from: e.source, port: e.sourceHandle ?? "next", to: e.target })),
  };
}

let counter = 0;
export function newNodeId(kind: NodeKind): string {
  counter++;
  return `${kind}-${Date.now().toString(36)}${counter}`;
}

export function newNodeData(kind: NodeKind): FlowNodeData {
  switch (kind) {
    case "assign":
      return { kind, target: "", expression: "" };
    case "decision":
    case "while":
      return { kind, condition: "" };
    case "return":
      return { kind, expression: "" };
    default:
      return { kind };
  }
}

export function starterDraft(problem: Problem): Draft {
  const props = problem.input_schema.properties ?? {};
  const bindings = inputNames(problem).map((name) => ({ name, type: schemaLabel(props[name]) }));
  const nodes: RFNode[] = [
    { id: "start", type: "flow", position: { x: 0, y: 0 }, data: { kind: "start" } },
    { id: "input", type: "flow", position: { x: -20, y: 90 }, data: { kind: "input", bindings } },
    { id: "return", type: "flow", position: { x: 0, y: 260 }, data: { kind: "return", expression: "" } },
  ];
  return { nodes, edges: [makeEdge("start", "next", "input")] };
}

const DRAFT_PREFIX = "algolab:draft:v1:";

export function loadDraft(slug: string): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + slug);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!Array.isArray(d.nodes) || !Array.isArray(d.edges)) return null;
    return {
      nodes: d.nodes.map((n) => ({ id: n.id, type: "flow", position: n.position, data: n.data })),
      edges: d.edges.map((e) => makeEdge(e.source, e.sourceHandle ?? "next", e.target, e.targetHandle)),
    };
  } catch {
    return null;
  }
}

export function saveDraft(slug: string, draft: Draft) {
  try {
    const clean: Draft = {
      nodes: draft.nodes.map((n) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { active, hasError, ...data } = n.data;
        return { id: n.id, type: "flow", position: n.position, data };
      }),
      edges: draft.edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle })),
    };
    localStorage.setItem(DRAFT_PREFIX + slug, JSON.stringify(clean));
  } catch {}
}

export function clearDraft(slug: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + slug);
  } catch {}
}
