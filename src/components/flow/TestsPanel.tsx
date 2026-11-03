"use client";

import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { formatValue } from "@/lib/engine/evaluate";
import type { JudgeReport } from "@/lib/engine/judge";
import type { Value } from "@/lib/engine/types";
import { ERROR_TITLE } from "@/lib/errorText";
import type { Problem } from "@/lib/problems";
import { button, field } from "../ui";

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
  invalid_graph: "The flowchart isn’t complete yet",
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
    <div className="space-y-6 p-4">
      <section aria-labelledby="results">
        <h2 id="results" className="text-lg font-semibold">
          Results
        </h2>

        {!submission && (
          <p className="mt-1 text-sm leading-normal text-label-2">
            Check examples runs the {problem.sample_cases.length} examples in your browser.{" "}
            {judgeAvailable
              ? "Judge solution also runs the hidden tests on the server."
              : "Hidden tests need the judge server, which this build doesn’t have."}
          </p>
        )}

        <button type="button" onClick={onCheckExamples} disabled={busy} className={`${button.gray} mt-3 w-full`}>
          Check examples
        </button>

        {submission?.error && (
          <div className="mt-3 rounded-xl bg-red-tint p-3 text-sm" role="alert">
            <p className="font-medium">The judge couldn’t be reached</p>
            <p className="mt-0.5 text-label-2">{submission.error}. Your flowchart is saved; try again in a moment.</p>
          </div>
        )}

        {report && (
          <div className="mt-3 space-y-3" aria-live="polite">
            <div className={`rounded-xl p-3 ${report.verdict === "accepted" ? "bg-green-tint" : "bg-red-tint"}`}>
              <p className="flex items-center gap-1.5 font-medium">
                {report.verdict === "accepted" ? (
                  <CircleCheck size={18} aria-hidden className="text-green" />
                ) : (
                  <CircleX size={18} aria-hidden className="text-red" />
                )}
                {VERDICT_TEXT[report.verdict]}
              </p>
              <p className="mt-0.5 text-sm text-label-2">
                {report.passed} / {report.total}{" "}
                {submission!.mode === "judge" ? "tests passed (public + hidden)" : "examples passed (browser check, no hidden tests)"}
                {report.verdict !== "invalid_graph" && <> · {report.totalSteps.toLocaleString("en-US")} steps total</>}
              </p>
              {submission!.submissionId && <p className="mt-1 font-mono text-xs text-label-2">Submission {submission!.submissionId}</p>}
            </div>
            {report.issues?.map((i, k) => (
              <p key={k} className="flex gap-1.5 text-sm">
                <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0 text-red" /> {i.message}
              </p>
            ))}
            {report.results.length > 0 && (
              <ul className="divide-y divide-separator rounded-xl border border-separator bg-surface">
                {report.results.map((r, k) => (
                  <li key={r.case_id} className="px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      {r.status === "passed" ? (
                        <CircleCheck size={16} aria-label="Passed" className="text-green" />
                      ) : (
                        <CircleX size={16} aria-label="Failed" className="text-red" />
                      )}
                      <span className="font-medium">{r.visibility === "public" ? `Example ${k + 1}` : `Hidden test ${k + 1}`}</span>
                      <span className="ml-auto text-label-2">
                        {r.status === "passed" ? `${r.steps} steps` : r.status === "wrong_answer" ? "Wrong answer" : "Runtime error"}
                      </span>
                    </div>
                    {r.visibility === "public" && r.status !== "passed" && (
                      <dl className="mt-1.5 space-y-0.5 font-mono break-all">
                        <div>
                          <dt className="inline font-sans text-label-2">Expected </dt>
                          <dd className="inline">{formatValue(r.expected as Value)}</dd>
                        </div>
                        {r.status === "wrong_answer" && (
                          <div>
                            <dt className="inline font-sans text-label-2">Got </dt>
                            <dd className="inline">{formatValue(r.actual as Value)}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                    {r.error && (
                      <p className="mt-1 text-label-2">
                        {ERROR_TITLE[r.error.code]}
                        {r.visibility === "public" && <>: {r.error.message}</>} <span className="font-mono text-xs">({r.error.code})</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="custom">
        <h2 id="custom" className="text-lg font-semibold">
          Custom input
        </h2>
        <p className="mt-1 text-sm text-label-2">Choose Custom input next to Run to execute these values. Enter each one as JSON.</p>
        <div className="mt-3 space-y-3">
          {Object.keys(custom).map((name) => (
            <div key={name}>
              <label htmlFor={`custom-${name}`} className="mb-1.5 block font-mono text-sm text-label-2">
                {name}
              </label>
              <textarea
                id={`custom-${name}`}
                value={custom[name]}
                onChange={(e) => setCustom({ ...custom, [name]: e.target.value })}
                rows={2}
                spellCheck={false}
                className={`${field} h-auto resize-y py-2 font-mono`}
              />
            </div>
          ))}
          {customError && (
            <p className="text-sm text-red" role="alert">
              {customError}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
