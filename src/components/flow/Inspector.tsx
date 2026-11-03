"use client";

import { useRef } from "react";
import { parseExpression, parseTarget } from "@/lib/engine/expression";
import type { FlowNodeData, RFNode } from "@/lib/flow/convert";
import { button, field } from "../ui";
import { KIND_META } from "./FlowNode";

type Field = "target" | "expression" | "condition" | "label";

function check(f: Field, value: string | undefined): string | null {
  if (f === "label" || !value?.trim()) return null;
  try {
    if (f === "target") parseTarget(value.trim());
    else parseExpression(value);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const FIELDS: Record<string, { field: Field; label: string; placeholder: string }[]> = {
  assign: [
    { field: "target", label: "Variable", placeholder: "count  or  result[i]" },
    { field: "expression", label: "Value", placeholder: "count + 1" },
  ],
  decision: [{ field: "condition", label: "Condition", placeholder: "numbers[i] % 2 == 0" }],
  while: [{ field: "condition", label: "Repeat while", placeholder: "i < len(numbers)" }],
  return: [{ field: "expression", label: "Return value", placeholder: "count" }],
};

export const PORT_LABEL: Record<string, string> = {
  next: "Then go to",
  true: "If true, go to",
  false: "If false, go to",
  body: "Loop body starts at",
  exit: "After the loop, go to",
};

export interface PortChoice {
  port: string;
  target: string | null;
}

export function Inspector({
  node,
  knownVars,
  ports,
  targets,
  onChange,
  onBeginEdit,
  onConnect,
  onDelete,
}: {
  node: RFNode;
  knownVars: string[];
  ports: PortChoice[];
  targets: { id: string; label: string }[];
  onChange: (patch: Partial<FlowNodeData>) => void;
  onBeginEdit: () => void;
  onConnect: (port: string, target: string | null) => void;
  onDelete: () => void;
}) {
  const d = node.data;
  const meta = KIND_META[d.kind];
  const Icon = meta.icon;
  const focused = useRef<{ el: HTMLInputElement; field: Field } | null>(null);
  const fields = FIELDS[d.kind] ?? [];
  const fixed = d.kind === "start" || d.kind === "input";

  const insert = (text: string) => {
    const last = fields.at(-1);
    const f = focused.current ?? (last ? { el: document.getElementById(`field-${last.field}`) as HTMLInputElement, field: last.field } : null);
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
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-2">
        <Icon size={18} aria-hidden className="text-label-2" />
        <h2 className="text-lg font-semibold">{meta.label}</h2>
      </div>
      <p className="-mt-3 text-sm text-label-2">{meta.hint}</p>

      {d.kind === "input" && (
        <div className="rounded-xl border border-separator bg-surface">
          {(d.bindings ?? []).map((b) => (
            <div key={b.name} className="flex justify-between border-b border-separator px-3 py-2.5 font-mono text-sm last:border-0">
              <span>{b.name}</span>
              <span className="text-label-2">{b.type}</span>
            </div>
          ))}
          <p className="px-3 py-2.5 text-sm text-label-2">Filled in from the problem’s input.</p>
        </div>
      )}

      {fields.map(({ field: f, label, placeholder }) => {
        const value = (d[f] as string | undefined) ?? "";
        const error = check(f, value);
        return (
          <div key={f}>
            <label htmlFor={`field-${f}`} className="mb-1.5 block text-sm font-medium text-label-2">
              {label}
            </label>
            <input
              id={`field-${f}`}
              value={value}
              placeholder={placeholder}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              onFocus={(e) => {
                focused.current = { el: e.currentTarget, field: f };
                onBeginEdit();
              }}
              onChange={(e) => onChange({ [f]: e.target.value })}
              className={`${field} font-mono ${error ? "border-red" : ""}`}
              aria-invalid={!!error}
              aria-describedby={error ? `err-${f}` : undefined}
            />
            {error && (
              <p id={`err-${f}`} className="mt-1.5 text-sm text-red">
                {error}
              </p>
            )}
          </div>
        );
      })}

      {fields.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-label-2">Insert</p>
          <div className="flex flex-wrap gap-2">
            {[...knownVars, "len()", "append(, )"].map((v) => (
              <button
                key={v}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(v)}
                className="h-11 rounded-lg bg-fill px-3 font-mono text-sm hover:bg-fill-strong"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {ports.map(({ port, target }) => (
        <div key={port}>
          <label htmlFor={`port-${port}`} className="mb-1.5 block text-sm font-medium text-label-2">
            {PORT_LABEL[port]}
          </label>
          <select
            id={`port-${port}`}
            value={target ?? ""}
            onChange={(e) => onConnect(port, e.target.value || null)}
            className={field}
          >
            <option value="">Not connected</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {!fixed && (
        <div>
          <label htmlFor="field-label" className="mb-1.5 block text-sm font-medium text-label-2">
            Label (optional)
          </label>
          <input
            id="field-label"
            value={d.label ?? ""}
            onFocus={onBeginEdit}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder={meta.label}
            className={field}
          />
        </div>
      )}

      <button type="button" onClick={() => onChange({ breakpoint: !d.breakpoint })} className={`${button.gray} w-full`}>
        {d.breakpoint ? "Remove breakpoint" : "Add breakpoint"}
      </button>

      {!fixed && (
        <div className="border-t border-separator pt-5">
          <button type="button" onClick={onDelete} className={`${button.destructivePlain} w-full`}>
            Delete node
          </button>
        </div>
      )}
    </div>
  );
}
