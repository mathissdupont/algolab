"use client";

import { formatValue } from "@/lib/engine/evaluate";
import type { JudgeReport } from "@/lib/engine/judge";
import type { Value } from "@/lib/engine/types";
import type { Problem } from "@/lib/problems";

export interface SubmissionState {
  mode: "judge" | "local";
  report?: JudgeReport;
  error?: string;
  submissionId?: string;
}

const VERDICT_TEXT = {
  accepted: "Accepted",
  wrong_answer: "Wrong answer",
  runtime_error: "Runtime error",
  invalid_graph: "Flowchart is not valid",
};

export function TestsPanel({
  problem,
  custom,
  setCustom,
  customError,
  submission,
  busy,
  onCheckExamples,
  judgeAvailable,
}: {
  problem: Problem;
  custom: Record<string, string>;
  setCustom: (c: Record<string, string>) => void;
  customError: string | null;
  submission: SubmissionState | null;
  busy: boolean;
  onCheckExamples: () => void;
  judgeAvailable: boolean;
}) {
  const report = submission?.report;
  return (
    <div className="space-y-5 p-4 text-sm">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Results</h2>
          <button
            onClick={onCheckExamples}
            disabled={busy}
            className="rounded-md border border-line px-2.5 py-1 text-xs hover:border-accent disabled:opacity-50"
          >
            Check examples
          </button>
        </div>

        {!submission && (
          <p className="mt-2 text-xs text-muted">
            <b className="text-fg">Check examples</b> runs the {problem.sample_cases.length} public examples in your browser.{" "}
            {judgeAvailable ? (
              <>
                <b className="text-fg">Submit</b> sends your flowchart to the judge, which also runs the hidden tests.
              </>
            ) : (
              <>The judge server is not configured for this build, so hidden tests are unavailable.</>
            )}
          </p>
        )}

        {submission?.error && (
          <div className="mt-2 rounded-lg border border-bad/40 bg-bad-soft p-3 text-xs">
            <b className="text-bad">Submission failed.</b> {submission.error}
          </div>
        )}

        {report && (
          <div className="mt-2 space-y-2">
            <div
              className={`rounded-lg border p-3 ${report.verdict === "accepted" ? "border-ok/40 bg-ok-soft" : "border-bad/40 bg-bad-soft"}`}
            >
              <div className={`font-semibold ${report.verdict === "accepted" ? "text-ok" : "text-bad"}`}>{VERDICT_TEXT[report.verdict]}</div>
              <div className="mt-0.5 text-xs text-muted">
                {report.passed} / {report.total} {submission!.mode === "judge" ? "tests passed (public + hidden)" : "examples passed (browser check, no hidden tests)"}
                {report.verdict !== "invalid_graph" && <> · {report.totalSteps.toLocaleString("en-US")} steps total</>}
              </div>
              {submission!.submissionId && <div className="mt-1 font-mono text-[10px] text-muted">submission {submission!.submissionId}</div>}
            </div>
            {report.issues?.map((i, k) => (
              <p key={k} className="text-xs text-bad">
                • {i.message}
              </p>
            ))}
            {report.results.map((r, k) => (
              <div key={r.case_id} className="rounded-lg border border-line p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className={r.status === "passed" ? "text-ok" : "text-bad"}>{r.status === "passed" ? "✓" : "✗"}</span>
                  <span className="font-medium">{r.visibility === "public" ? `Example ${k + 1}` : `Hidden test ${k + 1}`}</span>
                  <span className="ml-auto text-muted">{r.status === "passed" ? `${r.steps} steps` : r.status.replace("_", " ")}</span>
                </div>
                {r.visibility === "public" && r.status !== "passed" && (
                  <div className="mt-1.5 space-y-0.5 font-mono break-all">
                    <div>
                      <span className="text-muted">expected </span>
                      {formatValue(r.expected as Value)}
                    </div>
                    {r.status === "wrong_answer" && (
                      <div>
                        <span className="text-muted">got      </span>
                        {formatValue(r.actual as Value)}
                      </div>
                    )}
                  </div>
                )}
                {r.error && (
                  <div className="mt-1.5 text-bad">
                    <span className="font-mono">{r.error.code}</span>
                    {r.visibility === "public" && <> — {r.error.message}</>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Custom input</h2>
        <p className="mt-1 text-xs text-muted">Choose “Custom input” next to Run to execute these values (JSON).</p>
        <div className="mt-2 space-y-2">
          {Object.keys(custom).map((name) => (
            <label key={name} className="block">
              <span className="mb-1 block font-mono text-xs text-muted">{name}</span>
              <textarea
                value={custom[name]}
                onChange={(e) => setCustom({ ...custom, [name]: e.target.value })}
                rows={2}
                spellCheck={false}
                className="w-full resize-y rounded-md border border-line bg-panel px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
              />
            </label>
          ))}
          {customError && <p className="text-xs text-bad">{customError}</p>}
        </div>
      </section>
    </div>
  );
}
