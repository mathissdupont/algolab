"use client";

import { CircleCheck, CircleX, Copy, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatValue, valuesEqual } from "@/lib/engine/evaluate";
import type { ExecutionResult } from "@/lib/engine/interpreter";
import type { Value } from "@/lib/engine/types";
import { ERROR_TITLE } from "@/lib/errorText";
import type { RFNode } from "@/lib/flow/convert";
import { button } from "../ui";
import { KIND_META } from "./FlowNode";

export interface RunState {
  result: ExecutionResult;
  label: string;
  input: Record<string, Value>;
  expected?: Value;
  hasExpected: boolean;
}

function nodeSummary(n: RFNode | undefined): string {
  if (!n) return "?";
  const d = n.data;
  if (d.label?.trim()) return d.label;
  if (d.kind === "assign") return `${d.target} ← ${d.expression}`;
  if (d.kind === "decision" || d.kind === "while") return d.condition ?? "";
  if (d.kind === "return") return `return ${d.expression}`;
  return KIND_META[d.kind].label;
}

export function DebugPanel({
  run,
  cursor,
  setCursor,
  nodes,
  onFocusNode,
}: {
  run: RunState | null;
  cursor: number;
  setCursor: (i: number) => void;
  nodes: RFNode[];
  onFocusNode: (id: string) => void;
}) {
  const activeRow = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    activeRow.current?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!run) {
    return (
      <div className="space-y-2 p-4 text-sm leading-normal text-label-2">
        <p>
          <span className="font-medium text-label">Run</span> executes your flowchart on the selected example.{" "}
          <span className="font-medium text-label">Step forward</span> walks through it from the beginning.
        </p>
        <p>Add breakpoints from the Inspect tab; Run to breakpoint stops at the next one.</p>
      </div>
    );
  }

  const { result } = run;
  const trace = result.trace;
  const entry = trace[cursor];
  const prev = cursor > 0 ? trace[cursor - 1] : undefined;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const atEnd = cursor === trace.length - 1;
  const lo = Math.max(0, cursor - 60);
  const hi = Math.min(trace.length, cursor + 60);

  const copyDetails = async () => {
    const e = result.error!;
    try {
      await navigator.clipboard.writeText(`${e.code}: ${e.message}${e.nodeId ? ` (node ${e.nodeId})` : ""}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  let verdict: React.ReactNode;
  if (result.status === "error") {
    const e = result.error!;
    verdict = (
      <div className="rounded-xl bg-red-tint p-3" role="alert">
        <div className="flex items-start gap-2">
          <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-red" />
          <div className="min-w-0">
            <p className="font-medium">{ERROR_TITLE[e.code]}</p>
            <p className="mt-0.5 text-sm text-label-2">{e.message}</p>
            <p className="mt-1 font-mono text-xs text-label-2">{e.code}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {e.nodeId && (
            <button type="button" className={button.tinted} onClick={() => onFocusNode(e.nodeId!)}>
              Show node
            </button>
          )}
          <button type="button" className={button.plain} onClick={copyDetails}>
            <Copy size={16} aria-hidden /> {copied ? "Copied" : "Copy error details"}
          </button>
        </div>
      </div>
    );
  } else {
    const match = run.hasExpected ? valuesEqual(result.output as Value, run.expected as Value) : null;
    verdict = (
      <div className={`rounded-xl p-3 ${match === false ? "bg-red-tint" : match ? "bg-green-tint" : "bg-fill"}`}>
        <p className="text-sm text-label-2">Returned</p>
        <p className="font-mono break-all">{formatValue(result.output as Value)}</p>
        {match !== null && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
            {match ? (
              <>
                <CircleCheck size={16} aria-hidden className="text-green" /> Matches the expected output
              </>
            ) : (
              <>
                <CircleX size={16} aria-hidden className="text-red" /> Expected <span className="font-mono">{formatValue(run.expected as Value)}</span>
              </>
            )}
          </p>
        )}
      </div>
    );
  }

  const kindMeta = KIND_META[byId.get(entry?.nodeId ?? "")?.data.kind ?? "start"];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-separator p-4">
        <div className="flex items-baseline justify-between text-sm text-label-2">
          <span>{run.label}</span>
          <span>{result.steps.toLocaleString("en-US")} steps</span>
        </div>
        {atEnd || result.status === "error" ? (
          verdict
        ) : (
          <p className="rounded-xl bg-fill p-3 text-sm text-label-2">
            Paused at step {cursor + 1} of {trace.length}. Step forward or run to the next breakpoint to see the result.
          </p>
        )}
        {trace.length > 0 && (
          <div>
            <input
              type="range"
              min={0}
              max={trace.length - 1}
              value={cursor}
              onChange={(e) => setCursor(Number(e.target.value))}
              className="h-11 w-full accent-[var(--accent)]"
              aria-label="Timeline"
              aria-valuetext={`Step ${cursor + 1} of ${trace.length}`}
            />
            <div className="flex justify-between text-xs text-label-2">
              <span>
                Step {cursor + 1} of {trace.length}
              </span>
              {result.traceTruncated && <span>History keeps the first {trace.length.toLocaleString("en-US")} steps</span>}
            </div>
          </div>
        )}
      </div>

      {entry && (
        <div className="border-b border-separator p-4">
          <p className="flex items-center gap-1.5 text-sm text-label-2">
            <kindMeta.icon size={14} aria-hidden /> {kindMeta.label}
          </p>
          <p className="mt-0.5 truncate font-mono text-sm">{nodeSummary(byId.get(entry.nodeId))}</p>
          {entry.note && <p className="mt-0.5 text-sm text-accent">{entry.note.replace("→", "· goes to")}</p>}
          <h3 className="mt-4 mb-1.5 text-sm font-semibold text-label-2">Variables</h3>
          {Object.keys(entry.vars).length === 0 ? (
            <p className="text-sm text-label-2">No variables yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-separator">
                {Object.entries(entry.vars).map(([name, value]) => {
                  const changed = cursor > 0 && (!prev || !(name in prev.vars) || !valuesEqual(prev.vars[name], value));
                  return (
                    <tr key={name} className={changed ? "bg-accent-tint" : ""}>
                      <th scope="row" className="w-1/3 py-1.5 pr-2 pl-1 text-left align-top font-mono font-normal text-label-2">
                        {name}
                      </th>
                      <td className="py-1.5 pr-1 font-mono break-all">
                        {formatValue(value)}
                        {changed && <span className="ml-2 font-sans text-xs text-accent">changed</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <h3 className="mb-1.5 text-sm font-semibold text-label-2">History</h3>
        <div className="scroll-thin min-h-32 flex-1 overflow-y-auto rounded-xl border border-separator">
          {trace.slice(lo, hi).map((t, k) => {
            const i = lo + k;
            return (
              <button
                key={i}
                type="button"
                ref={i === cursor ? activeRow : undefined}
                onClick={() => setCursor(i)}
                aria-current={i === cursor ? "step" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 border-b border-separator px-3 text-left text-sm last:border-0 ${
                  i === cursor ? "bg-accent-tint text-label" : "text-label-2 hover:bg-fill"
                }`}
              >
                <span className="w-8 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
                <span className="truncate font-mono">{nodeSummary(byId.get(t.nodeId))}</span>
                {t.note && <span className="ml-auto shrink-0 text-xs">{t.note.replace("condition is ", "")}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
