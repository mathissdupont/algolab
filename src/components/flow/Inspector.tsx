"use client";

import { useRef } from "react";
import { parseExpression, parseTarget } from "@/lib/engine/expression";
import type { FlowNodeData, RFNode } from "@/lib/flow/convert";
import { KIND_META } from "./FlowNode";

type Field = "target" | "expression" | "condition" | "label";

function check(field: Field, value: string | undefined): string | null {
  if (field === "label" || !value?.trim()) return null;
  try {
    if (field === "target") parseTarget(value.trim());
    else parseExpression(value);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const FIELDS: Record<string, { field: Field; label: string; placeholder: string }[]> = {
  assign: [
    { field: "target", label: "Variable", placeholder: "count   or   result[i]" },
    { field: "expression", label: "Value", placeholder: "count + 1" },
  ],
  decision: [{ field: "condition", label: "Condition", placeholder: "numbers[i] % 2 == 0" }],
  while: [{ field: "condition", label: "Repeat while", placeholder: "i < len(numbers)" }],
  return: [{ field: "expression", label: "Return value", placeholder: "count" }],
};

export function Inspector({
  node,
  knownVars,
  onChange,
  onBeginEdit,
  onDelete,
}: {
  node: RFNode;
  knownVars: string[];
  onChange: (patch: Partial<FlowNodeData>) => void;
  onBeginEdit: () => void;
  onDelete: () => void;
}) {
  const d = node.data;
  const meta = KIND_META[d.kind];
  const focused = useRef<{ el: HTMLInputElement; field: Field } | null>(null);
  const fields = FIELDS[d.kind] ?? [];

  const insert = (text: string) => {
    const f = focused.current ?? (fields.length ? { el: document.getElementById(`field-${fields.at(-1)!.field}`) as HTMLInputElement, field: fields.at(-1)!.field } : null);
    if (!f?.el) return;
    const cur = (d[f.field] as string | undefined) ?? "";
    const start = f.el.selectionStart ?? cur.length;
    const end = f.el.selectionEnd ?? cur.length;
    onBeginEdit();
    onChange({ [f.field]: cur.slice(0, start) + text + cur.slice(end) });
    requestAnimationFrame(() => {
      f.el.focus();
      f.el.setSelectionRange(start + text.length, start + text.length);
    });
  };

  return (
    <div className="space-y-4 p-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
        <h2 className="font-semibold">{meta.label} node</h2>
        <span className="ml-auto font-mono text-[10px] text-muted">{node.id}</span>
      </div>
      <p className="-mt-2 text-xs text-muted">{meta.hint}</p>

      {d.kind === "input" && (
        <div className="rounded-lg border border-line bg-panel-2 p-3 font-mono text-xs leading-6">
          {(d.bindings ?? []).map((b) => (
            <div key={b.name}>
              {b.name}: <span className="text-accent">{b.type}</span>
            </div>
          ))}
          <p className="mt-2 font-sans text-muted">Bound automatically from the problem input.</p>
        </div>
      )}

      {fields.map(({ field, label, placeholder }) => {
        const value = (d[field] as string | undefined) ?? "";
        const error = check(field, value);
        return (
          <label key={field} className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
            <input
              id={`field-${field}`}
              value={value}
              placeholder={placeholder}
              spellCheck={false}
              autoComplete="off"
              onFocus={(e) => {
                focused.current = { el: e.currentTarget, field };
                onBeginEdit();
              }}
              onChange={(e) => onChange({ [field]: e.target.value })}
              className={`h-9 w-full rounded-md border bg-panel px-2 font-mono text-[13px] outline-none ${
                error ? "border-bad" : "border-line focus:border-accent"
              }`}
              aria-invalid={!!error}
            />
            {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
          </label>
        );
      })}

      {fields.length > 0 && knownVars.length > 0 && (
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Insert variable</span>
          <div className="flex flex-wrap gap-1">
            {knownVars.map((v) => (
              <button
                key={v}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(v)}
                className="rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-xs hover:border-accent"
              >
                {v}
              </button>
            ))}
            {["len()", "append(, )"].map((fn) => (
              <button
                key={fn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(fn)}
                className="rounded border border-dashed border-line px-1.5 py-0.5 font-mono text-xs text-muted hover:border-accent"
              >
                {fn}
              </button>
            ))}
          </div>
        </div>
      )}

      {d.kind !== "start" && d.kind !== "input" && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Label (optional)</span>
          <input
            value={d.label ?? ""}
            onFocus={onBeginEdit}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder={meta.label}
            className="h-9 w-full rounded-md border border-line bg-panel px-2 outline-none focus:border-accent"
          />
        </label>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => onChange({ breakpoint: !d.breakpoint })}
          className={`rounded-md border px-3 py-1.5 text-xs ${d.breakpoint ? "border-bad text-bad" : "border-line text-muted hover:text-fg"}`}
        >
          {d.breakpoint ? "● Remove breakpoint" : "○ Add breakpoint"}
        </button>
        {d.kind !== "start" && d.kind !== "input" && (
          <button onClick={onDelete} className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:border-bad hover:text-bad">
            Delete node
          </button>
        )}
      </div>
    </div>
  );
}
