"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { NodeKind } from "@/lib/engine/types";
import type { RFNode } from "@/lib/flow/convert";

export const KIND_META: Record<NodeKind, { label: string; color: string; hint: string }> = {
  start: { label: "Start", color: "#64748b", hint: "Execution begins here" },
  input: { label: "Input", color: "#059669", hint: "Reads the problem input" },
  assign: { label: "Assign", color: "#6366f1", hint: "variable ← expression" },
  decision: { label: "Decision", color: "#d97706", hint: "Branch on a condition" },
  while: { label: "While", color: "#0284c7", hint: "Repeat while true" },
  return: { label: "Return", color: "#e11d48", hint: "Return the answer" },
};

function PortLabel({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`pointer-events-none absolute text-[10px] font-semibold ${className}`}>{children}</span>;
}

function Placeholder({ text }: { text: string }) {
  return <span className="italic text-muted">{text}</span>;
}

function FlowNodeView({ data }: NodeProps<RFNode>) {
  const meta = KIND_META[data.kind];
  const cls = `flow-node relative min-w-[150px] max-w-[260px] rounded-lg border border-line bg-panel text-fg shadow-sm ${
    data.active ? "is-active" : ""
  } ${data.hasError ? "has-error" : ""}`;
  const pill = data.kind === "start" || data.kind === "return";

  let body: React.ReactNode = null;
  switch (data.kind) {
    case "start":
      body = null;
      break;
    case "input":
      body = (data.bindings ?? []).map((b) => (
        <div key={b.name}>
          {b.name}
          <span className="text-muted">: {b.type}</span>
        </div>
      ));
      break;
    case "assign":
      body = (
        <>
          {data.target?.trim() ? data.target : <Placeholder text="target" />}
          <span className="text-muted"> ← </span>
          {data.expression?.trim() ? data.expression : <Placeholder text="expression" />}
        </>
      );
      break;
    case "decision":
    case "while":
      body = data.condition?.trim() ? data.condition : <Placeholder text="condition" />;
      break;
    case "return":
      body = data.expression?.trim() ? data.expression : <Placeholder text="expression" />;
      break;
  }

  return (
    <div className={`${cls} ${pill ? "rounded-full" : ""}`} style={{ borderLeft: pill ? undefined : `4px solid ${meta.color}` }}>
      {data.kind !== "start" && <Handle type="target" position={Position.Top} id="in" />}
      {data.kind === "while" && <Handle type="target" position={Position.Left} id="loop" />}

      <div className={`flex items-center gap-2 px-3 ${pill ? "justify-center py-2" : "pt-1.5"}`}>
        {pill && <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />}
        <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: meta.color }}>
          {data.label?.trim() || meta.label}
        </span>
        {data.breakpoint && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-bad" title="Breakpoint" />}
      </div>
      {body !== null && (
        <div className={`px-3 pb-2 font-mono text-xs leading-5 break-words ${pill ? "-mt-1 text-center" : "pt-0.5"}`}>{body}</div>
      )}

      {(data.kind === "start" || data.kind === "input" || data.kind === "assign") && (
        <Handle type="source" position={Position.Bottom} id="next" />
      )}
      {data.kind === "decision" && (
        <>
          <Handle type="source" position={Position.Bottom} id="true" style={{ background: "var(--ok)" }} />
          <PortLabel className="-bottom-4 left-1/2 ml-2 text-ok">true</PortLabel>
          <Handle type="source" position={Position.Right} id="false" style={{ background: "var(--bad)" }} />
          <PortLabel className="-right-9 top-1/2 -mt-5 text-bad">false</PortLabel>
        </>
      )}
      {data.kind === "while" && (
        <>
          <Handle type="source" position={Position.Bottom} id="body" style={{ background: "var(--accent)" }} />
          <PortLabel className="-bottom-4 left-1/2 ml-2 text-accent">body</PortLabel>
          <Handle type="source" position={Position.Right} id="exit" />
          <PortLabel className="-right-8 top-1/2 -mt-5 text-muted">exit</PortLabel>
        </>
      )}
    </div>
  );
}

export const FlowNodeComponent = memo(FlowNodeView);
