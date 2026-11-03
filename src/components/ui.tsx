"use client";

// Shared controls. Every control is at least 44×44px; icon-only controls
// carry an aria-label plus a tooltip that opens on hover and on focus.

import { useEffect, useId, useState } from "react";

export { button, field } from "./styles";

/** Ctrl or ⌘ depending on platform (Ctrl until mounted, to match the static HTML). */
export function useModKey(): string {
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod("⌘");
  }, []);
  return mod;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="ml-2 rounded bg-fill-strong px-1.5 font-mono text-xs">{children}</kbd>;
}

export function Tooltip({
  label,
  shortcut,
  align = "center",
  children,
}: {
  label: string;
  shortcut?: string;
  align?: "center" | "end" | "start";
  children: (describedBy: string) => React.ReactNode;
}) {
  const id = useId();
  const pos = align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className="group relative inline-flex">
      {children(id)}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute top-full z-50 mt-2 hidden whitespace-nowrap rounded-md bg-label px-2 py-1 text-xs text-bg group-focus-within:block group-hover:block ${pos}`}
      >
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </span>
    </span>
  );
}

export function IconButton({
  label,
  shortcut,
  onClick,
  disabled,
  align,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  align?: "center" | "end" | "start";
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut} align={align}>
      {(describedBy) => (
        <button
          type="button"
          aria-label={label}
          aria-describedby={describedBy}
          onClick={onClick}
          disabled={disabled}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-label hover:bg-fill disabled:opacity-35 disabled:pointer-events-none"
        >
          {children}
        </button>
      )}
    </Tooltip>
  );
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-[10px] bg-fill p-0.5 ${className}`}>
      {options.map((o, i) => {
        const on = o.value === value;
        // Hairline between two unselected neighbours, as in a native segmented control.
        const divider = i > 0 && !on && options[i - 1].value !== value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative h-11 min-w-[4.5rem] flex-1 rounded-lg px-3 text-sm font-medium whitespace-nowrap ${
              on ? "bg-surface text-label shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-label-2 hover:text-label"
            } ${divider ? "before:absolute before:top-3 before:bottom-3 before:left-0 before:w-px before:bg-separator" : ""}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex h-11 cursor-pointer items-center gap-3 text-sm text-label">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex h-11 w-[51px] shrink-0 items-center">
        <span className={`relative h-[31px] w-[51px] rounded-full transition-colors duration-200 ${checked ? "bg-green" : "bg-fill-strong"}`}>
          <span
            className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-transform duration-200 ease-out ${
              checked ? "translate-x-5" : ""
            }`}
          />
        </span>
      </button>
      {label}
    </label>
  );
}

export function Group({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-xl border border-separator bg-surface ${className}`}>{children}</div>;
}

export function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-2 px-1 text-sm font-semibold text-label-2">
      {children}
    </h2>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto mt-24 flex max-w-5xl flex-wrap items-center justify-between gap-2 border-t border-separator px-4 py-6 text-sm text-label-2">
      <span>AlgoLab — design algorithms as runnable flowcharts.</span>
      <a href="https://github.com/mathissdupont/algolab" className="inline-flex h-11 items-center text-accent" target="_blank" rel="noreferrer">
        View source
      </a>
    </footer>
  );
}
