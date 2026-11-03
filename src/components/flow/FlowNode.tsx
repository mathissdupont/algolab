"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CirclePlay, CornerDownLeft, Diamond, Equal, LogIn, Repeat, TriangleAlert, type LucideIcon } from "lucide-react";
import { memo } from "react";
import type { NodeKind } from "@/lib/engine/types";
import type { RFNode } from "@/lib/flow/convert";

export const KIND_META: Record<NodeKind, { label: string; hint: string; icon: LucideIcon }> = {
  start: { label: "Start", hint: "Execution begins here", icon: CirclePlay },
  input: { label: "Input", hint: "Reads the problem input", icon: LogIn },
  assign: { label: "Assign", hint: "Store a value in a variable", icon: Equal },
  decision: { label: "Decision", hint: "Branch on a condition", icon: Diamond },
  while: { label: "While", hint: "Repeat while a condition holds", icon: Repeat },
  return: { label: "Return", hint: "Return the answer", icon: CornerDownLeft },
};

function PortLabel({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`pointer-events-none absolute text-xs text-label-2 ${className}`}>{children}</span>;
}

function Placeholder({ text }: { text: string }) {
  return <span className="text-label-3">{text}</span>;
}

function FlowNodeView({ data }: NodeProps<RFNode>) {
  const meta = KIND_META[data.kind];
  const Icon = meta.icon;

  let body: React.ReactNode = null;
  switch (data.kind) {
    case "input":
      body = (data.bindings ?? []).map((b) => (
        <div key={b.name}>
          {b.name}
          <span className="text-label-2">: {b.type}</span>
        </div>
      ));
      break;
    case "assign":
      body = (
        <>
          {data.target?.trim() ? data.target : <Placeholder text="variable" />}
          <span className="text-label-2"> ← </span>
          {data.expression?.trim() ? data.expression : <Placeholder text="value" />}
        </>
      );
      break;
    case "decision":
    case "while":
      body = data.condition?.trim() ? data.condition : <Placeholder text="condition" />;
      break;
    case "return":
      body = data.expression?.trim() ? data.expression : <Placeholder text="value" />;
      break;
  }

  return (
    <div
      className={`flow-node relative min-w-[160px] max-w-[280px] rounded-xl border border-separator bg-surface text-label shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
        data.active ? "is-active" : ""
      } ${data.hasError ? "has-error" : ""}`}
    >
      {data.kind !== "start" && <Handle type="target" position={Position.Top} id="in" />}
      {data.kind === "while" && <Handle type="target" position={Position.Left} id="loop" />}

      <div className={`flex items-center gap-1.5 px-3 pt-2 ${body === null ? "pb-2" : ""}`}>
        <Icon size={14} aria-hidden className={data.active ? "text-accent" : "text-label-2"} />
        <span className={`text-xs font-medium ${data.active ? "text-accent" : "text-label-2"}`}>{data.label?.trim() || meta.label}</span>
        {data.hasError && <TriangleAlert size={14} aria-label="Has a problem" className="text-red" />}
        {data.breakpoint && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-red" role="img" aria-label="Breakpoint" />}
      </div>
      {body !== null && <div className="px-3 pt-0.5 pb-2.5 font-mono text-sm leading-normal break-words">{body}</div>}

      {(data.kind === "start" || data.kind === "input" || data.kind === "assign") && (
        <Handle type="source" position={Position.Bottom} id="next" />
      )}
      {data.kind === "decision" && (
        <>
          <Handle type="source" position={Position.Bottom} id="true" />
          <PortLabel className="-bottom-5 left-1/2 ml-2.5">true</PortLabel>
          <Handle type="source" position={Position.Right} id="false" />
          <PortLabel className="top-1/2 -right-11 -mt-5">false</PortLabel>
        </>
      )}
      {data.kind === "while" && (
        <>
          <Handle type="source" position={Position.Bottom} id="body" />
          <PortLabel className="-bottom-5 left-1/2 ml-2.5">body</PortLabel>
          <Handle type="source" position={Position.Right} id="exit" />
          <PortLabel className="top-1/2 -right-10 -mt-5">exit</PortLabel>
        </>
      )}
    </div>
  );
}

export const FlowNodeComponent = memo(FlowNodeView);
