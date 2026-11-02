"use client";

import { useEffect, useRef } from "react";
import { formatValue, valuesEqual } from "@/lib/engine/evaluate";
import type { ExecutionResult } from "@/lib/engine/interpreter";
import type { Value } from "@/lib/engine/types";
import type { RFNode } from "@/lib/flow/convert";
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
  useEffect(() => {
    activeRow.current?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!run) {
    return (
      <div className="p-4 text-sm text-muted">
        <p>Press <b className="text-fg">Run</b> to execute your flowchart on the selected example, or <b className="text-fg">Step</b> to walk through it from the beginning.</p>
        <p className="mt-2">Add breakpoints in the Inspect tab; <b className="text-fg">Continue</b> jumps to the next one.</p>
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

  let verdict: React.ReactNode;
  if (result.status === "error") {
    verdict = (
      <div className="rounded-lg border border-bad/40 bg-bad-soft p-3">
        <div className="font-mono text-xs font-semibold text-bad">{result.error!.code}</div>
        <p className="mt-1">{result.error!.message}</p>
        {result.error!.nodeId && (
          <button className="mt-1 text-xs text-bad underline" onClick={() => onFocusNode(result.error!.nodeId!)}>
            Show node
          </button>
        )}
      </div>
    );
  } else {
    const match = run.hasExpected ? valuesEqual(result.output as Value, run.expected as Value) : null;
    verdict = (
      <div className={`rounded-lg border p-3 ${match === false ? "border-bad/40 bg-bad-soft" : match ? "border-ok/40 bg-ok-soft" : "border-line bg-panel-2"}`}>
        <div className="text-xs text-muted">Returned</div>
        <div className="font-mono text-sm break-all">{formatValue(result.output as Value)}</div>
        {match !== null && (
          <div className={`mt-1 text-xs font-medium ${match ? "text-ok" : "text-bad"}`}>
            {match ? "✓ Matches the expected output" : <>✗ Expected <span className="font-mono">{formatValue(run.expected as Value)}</span></>}
          </div>
        )}
      </div>
    );
  }

  const vars = entry ? Object.entries(entry.vars) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col text-sm">
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span>{run.label}</span>
          <span>{result.steps.toLocaleString("en-US")} steps</span>
        </div>
        {atEnd || result.status === "error" ? verdict : (
          <div className="rounded-lg border border-line bg-panel-2 p-3 text-xs text-muted">
            Paused at step {cursor + 1} of {trace.length}. Step forward or Continue to see the result.
          </div>
        )}
        {trace.length > 0 && (
          <div>
            <input
              type="range"
              min={0}
              max={trace.length - 1}
              value={cursor}
              onChange={(e) => setCursor(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
              aria-label="Execution timeline"
            />
            <div className="flex justify-between text-[11px] text-muted">
              <span>
                Step {cursor + 1} / {trace.length}
              </span>
              {result.traceTruncated && <span>trace limited to first {trace.length.toLocaleString("en-US")} steps</span>}
            </div>
          </div>
        )}
      </div>

      {entry && (
        <div className="border-b border-line p-4">
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="font-semibold" style={{ color: KIND_META[byId.get(entry.nodeId)?.data.kind ?? "start"].color }}>
              {KIND_META[byId.get(entry.nodeId)?.data.kind ?? "start"].label}
            </span>
            <span className="truncate font-mono">{nodeSummary(byId.get(entry.nodeId))}</span>
          </div>
          {entry.note && <div className="mb-2 font-mono text-xs text-accent">{entry.note}</div>}
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Variables</h3>
          {vars.length === 0 ? (
            <p className="text-xs text-muted">No variables yet.</p>
          ) : (
            <table className="w-full font-mono text-xs">
              <tbody>
                {vars.map(([name, value]) => {
                  const changed = !prev || !(name in prev.vars) || !valuesEqual(prev.vars[name], value);
                  return (
                    <tr key={name} className={changed && cursor > 0 ? "bg-accent-soft" : ""}>
                      <td className="w-1/3 py-0.5 pr-2 align-top text-muted">{name}</td>
                      <td className="py-0.5 break-all">{formatValue(value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col p-4 pt-3">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">History</h3>
        <div className="scroll-thin min-h-24 flex-1 overflow-y-auto rounded-md border border-line">
          {trace.slice(lo, hi).map((t, k) => {
            const i = lo + k;
            const n = byId.get(t.nodeId);
            return (
              <button
                key={i}
                ref={i === cursor ? activeRow : undefined}
                onClick={() => setCursor(i)}
                className={`flex w-full gap-2 px-2 py-1 text-left font-mono text-[11px] ${i === cursor ? "bg-accent-soft text-fg" : "text-muted hover:bg-panel-2"}`}
              >
                <span className="w-8 shrink-0 text-right">{i + 1}</span>
                <span className="truncate">{nodeSummary(n)}</span>
                {t.note && <span className="ml-auto shrink-0">{t.note.replace("condition is ", "")}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
