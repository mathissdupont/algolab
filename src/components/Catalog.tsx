"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Difficulty, ProblemSummary } from "@/lib/problems";

export const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Easy: "text-ok bg-ok-soft",
  Medium: "text-warn bg-warn-soft",
  Hard: "text-bad bg-bad-soft",
};

export function Catalog({ items }: { items: ProblemSummary[] }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [topic, setTopic] = useState("All");
  const [runnableOnly, setRunnableOnly] = useState(false);

  const topics = useMemo(() => ["All", ...[...new Set(items.map((p) => p.category))].sort()], [items]);
  const shown = items.filter((p) => {
    if (difficulty !== "All" && p.difficulty !== difficulty) return false;
    if (topic !== "All" && p.category !== topic) return false;
    if (runnableOnly && !p.supported) return false;
    const q = query.trim().toLowerCase();
    return !q || p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, ID or topic"
          className="h-9 w-full rounded-lg border border-line bg-panel px-3 text-sm outline-none focus:border-accent sm:w-64"
          aria-label="Search problems"
        />
        <div className="flex gap-1" role="group" aria-label="Difficulty">
          {(["All", "Easy", "Medium", "Hard"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              aria-pressed={difficulty === d}
              className={`h-9 rounded-lg border px-3 text-sm ${difficulty === d ? "border-accent bg-accent-soft text-accent" : "border-line bg-panel text-muted hover:text-fg"}`}
            >
              {d}
            </button>
          ))}
        </div>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="h-9 rounded-lg border border-line bg-panel px-2 text-sm"
          aria-label="Topic"
        >
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={runnableOnly} onChange={(e) => setRunnableOnly(e.target.checked)} className="accent-[var(--accent)]" />
          Runnable only
        </label>
        <span className="ml-auto text-sm text-muted">{shown.length} shown</span>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <li key={p.id}>
            <Link
              href={`/problems/${p.slug}/`}
              className={`flex h-full flex-col rounded-xl border border-line bg-panel p-4 transition hover:border-accent ${p.supported ? "" : "opacity-70"}`}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted">{p.id}</span>
                <span className={`rounded px-1.5 py-0.5 font-medium ${DIFFICULTY_STYLE[p.difficulty]}`}>{p.difficulty}</span>
                {!p.supported && <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-muted">Coming soon</span>}
              </div>
              <h2 className="mt-2 font-medium">{p.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{p.statement}</p>
              <p className="mt-auto pt-3 text-xs text-muted">{p.category}</p>
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="mt-10 text-center text-sm text-muted">No problems match these filters.</p>}
    </>
  );
}
