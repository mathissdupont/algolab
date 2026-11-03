"use client";

// Page pattern: List / Index — grouped list in L1 frames with hairlines.
import { ChevronRight, Lock, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Difficulty, ProblemSummary } from "@/lib/problems";
import { Group, Segmented, Switch, button, field } from "./ui";

const LEVELS: Difficulty[] = ["Easy", "Medium", "Hard"];

export function Catalog({ items }: { items: ProblemSummary[] }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [topic, setTopic] = useState("All");
  const [runnableOnly, setRunnableOnly] = useState(false);

  const topics = useMemo(() => ["All", ...[...new Set(items.map((p) => p.category))].sort()], [items]);
  const q = query.trim().toLowerCase();
  const shown = items.filter(
    (p) =>
      (difficulty === "All" || p.difficulty === difficulty) &&
      (topic === "All" || p.category === topic) &&
      (!runnableOnly || p.supported) &&
      (!q || p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)),
  );
  const filtered = q || difficulty !== "All" || topic !== "All" || runnableOnly;
  const clear = () => {
    setQuery("");
    setDifficulty("All");
    setTopic("All");
    setRunnableOnly(false);
  };

  return (
    <>
      <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label htmlFor="problem-search" className="mb-1.5 block text-sm font-medium text-label-2">
            Search problems
          </label>
          <div className="relative">
            <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-label-3" />
            <input
              id="problem-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, ID or topic"
              className={`${field} pl-10`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="problem-topic" className="mb-1.5 block text-sm font-medium text-label-2">
            Topic
          </label>
          <select id="problem-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={`${field} md:w-56`}>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t === "All" ? "All topics" : t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={[{ value: "All", label: "All" }, ...LEVELS.map((l) => ({ value: l, label: l }))]}
          className="w-full sm:w-auto"
        />
        {items.some((p) => !p.supported) && <Switch label="Solvable now only" checked={runnableOnly} onChange={setRunnableOnly} />}
      </div>

      <p className="mt-6 text-sm text-label-2" aria-live="polite">
        {shown.length} of {items.length} problems
      </p>

      {shown.length === 0 ? (
        <Group className="mt-3 px-6 py-10 text-center">
          <h2 className="font-semibold">No problems match these filters</h2>
          <p className="mt-1 text-sm text-label-2">Clear the filters to see all {items.length} problems again.</p>
          <button type="button" onClick={clear} className={`${button.tinted} mt-4`}>
            Clear filters
          </button>
        </Group>
      ) : (
        LEVELS.map((level) => {
          const rows = shown.filter((p) => p.difficulty === level);
          if (!rows.length) return null;
          return (
            <section key={level} className="mt-6" aria-labelledby={`level-${level}`}>
              <h2 id={`level-${level}`} className="mb-2 px-1 text-sm font-semibold text-label-2">
                {level} · {rows.length}
              </h2>
              <Group>
                <ul className="divide-y divide-separator">
                  {rows.map((p) => (
                    <li key={p.id}>
                      <Link href={`/problems/${p.slug}/`} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-fill">
                        <div className="min-w-0 flex-1">
                          <div className={`font-medium ${p.supported ? "" : "text-label-2"}`}>{p.title}</div>
                          <div className="mt-0.5 truncate text-sm text-label-2">{p.statement}</div>
                          <div className="mt-1 text-xs text-label-3">
                            <span className="font-mono">{p.id}</span> · {p.category}
                          </div>
                        </div>
                        {p.supported ? (
                          <ChevronRight size={20} aria-hidden className="shrink-0 text-label-3" />
                        ) : (
                          <span className="flex shrink-0 items-center gap-1.5 text-sm text-label-2">
                            <Lock size={14} aria-hidden />
                            Coming soon
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Group>
            </section>
          );
        })
      )}
      {filtered && shown.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={clear} className={button.plain}>
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
