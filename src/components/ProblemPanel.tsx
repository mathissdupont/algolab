import { formatValue } from "@/lib/engine/evaluate";
import { schemaLabel, type Problem } from "@/lib/problems";
import { DIFFICULTY_STYLE } from "./Catalog";

export function ProblemPanel({ problem }: { problem: Problem }) {
  const props = problem.input_schema.properties ?? {};
  return (
    <div className="space-y-5 p-4 text-sm">
      <div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-muted">{problem.id}</span>
          <span className={`rounded px-1.5 py-0.5 font-medium ${DIFFICULTY_STYLE[problem.difficulty]}`}>{problem.difficulty}</span>
          <span className="text-muted">{problem.category}</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{problem.title}</h1>
        <p className="mt-3 leading-relaxed">{problem.statement}</p>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Contract</h2>
        <div className="rounded-lg border border-line bg-panel-2 p-3 font-mono text-xs leading-6">
          {Object.entries(props).map(([name, s]) => (
            <div key={name}>
              <span className="text-muted">input </span>
              {name}: <span className="text-accent">{schemaLabel(s)}</span>
            </div>
          ))}
          <div>
            <span className="text-muted">return </span>
            <span className="text-accent">{schemaLabel(problem.output_schema)}</span>
          </div>
        </div>
      </section>

      {problem.constraints.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Constraints</h2>
          <ul className="space-y-1 font-mono text-xs">
            {problem.constraints.map((c) => (
              <li key={c}>• {c}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Examples</h2>
        <div className="space-y-2">
          {problem.sample_cases.map((c, i) => (
            <div key={c.case_id} className="rounded-lg border border-line p-3 font-mono text-xs leading-5">
              <div className="mb-1 font-sans text-[11px] font-medium text-muted">Example {i + 1}</div>
              {Object.entries(c.input).map(([k, v]) => (
                <div key={k} className="break-all">
                  {k} = {formatValue(v)}
                </div>
              ))}
              <div className="mt-1 break-all">
                <span className="text-muted">→ </span>
                {formatValue(c.output)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted">
        {problem.test_count} judge tests ({problem.sample_cases.length} shown above). Target complexity: {problem.suggested_time_complexity}.
      </p>
    </div>
  );
}
