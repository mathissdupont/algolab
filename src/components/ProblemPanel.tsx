import { formatValue } from "@/lib/engine/evaluate";
import { schemaLabel, type Problem } from "@/lib/problems";

export function ProblemPanel({ problem }: { problem: Problem }) {
  const props = problem.input_schema.properties ?? {};
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <div>
        <p className="text-sm text-label-2">
          <span className="font-mono">{problem.id}</span> · {problem.difficulty} · {problem.category}
        </p>
        <h1 className="mt-1 text-2xl leading-tight font-semibold">{problem.title}</h1>
        <p className="mt-3 max-w-[65ch] leading-normal">{problem.statement}</p>
      </div>

      <section aria-labelledby="contract">
        <h2 id="contract" className="mb-2 text-sm font-semibold text-label-2">
          Inputs and output
        </h2>
        <dl className="divide-y divide-separator rounded-xl border border-separator bg-surface">
          {Object.entries(props).map(([name, s]) => (
            <div key={name} className="flex items-baseline justify-between gap-4 px-3 py-2.5">
              <dt className="font-mono text-sm">{name}</dt>
              <dd className="font-mono text-sm text-label-2">{schemaLabel(s)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 px-3 py-2.5">
            <dt className="text-sm">Returns</dt>
            <dd className="font-mono text-sm text-label-2">{schemaLabel(problem.output_schema)}</dd>
          </div>
        </dl>
      </section>

      {problem.constraints.length > 0 && (
        <section aria-labelledby="constraints">
          <h2 id="constraints" className="mb-2 text-sm font-semibold text-label-2">
            Constraints
          </h2>
          <ul className="space-y-1 font-mono text-sm">
            {problem.constraints.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="examples">
        <h2 id="examples" className="mb-2 text-sm font-semibold text-label-2">
          Examples
        </h2>
        <div className="space-y-3">
          {problem.sample_cases.map((c, i) => (
            <div key={c.case_id} className="rounded-xl border border-separator bg-surface">
              <div className="border-b border-separator px-3 py-2 text-sm font-medium">Example {i + 1}</div>
              <dl className="space-y-1.5 px-3 py-2.5 font-mono text-sm">
                {Object.entries(c.input).map(([k, v]) => (
                  <div key={k} className="break-all">
                    <dt className="inline text-label-2">{k} = </dt>
                    <dd className="inline">{formatValue(v)}</dd>
                  </div>
                ))}
                <div className="break-all">
                  <dt className="inline font-sans text-label-2">Returns </dt>
                  <dd className="inline">{formatValue(c.output)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-label-2">
        Judged on {problem.test_count} tests: the {problem.sample_cases.length} above plus hidden ones. Aim for {problem.suggested_time_complexity}.
      </p>
    </div>
  );
}
