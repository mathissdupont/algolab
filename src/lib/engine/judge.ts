// Shared by the browser (public samples) and the Cloudflare Worker judge
// (public + private cases). Private-case details never leave this function.

import { valuesEqual } from "./evaluate";
import { runCompiled, type RunError } from "./interpreter";
import type { FlowGraph, Value } from "./types";
import { validateGraph, type Issue } from "./validate";

export interface JudgeCase {
  case_id: string;
  input: Record<string, Value>;
  output: Value;
  visibility: "public" | "private";
}

export interface CaseResult {
  case_id: string;
  visibility: "public" | "private";
  status: "passed" | "wrong_answer" | "runtime_error";
  steps: number;
  input?: Record<string, Value>;
  expected?: Value;
  actual?: Value;
  error?: RunError;
}

export type Verdict = "accepted" | "wrong_answer" | "runtime_error" | "invalid_graph";

export interface JudgeReport {
  verdict: Verdict;
  passed: number;
  total: number;
  results: CaseResult[];
  issues?: Issue[];
  totalSteps: number;
}

/**
 * Judging uses a tighter step budget than interactive runs so a submission
 * fits the serverless judge's CPU allowance. Seed solutions need < 300 steps
 * per case, so this leaves ~100x headroom.
 */
export const JUDGE_LIMITS = { maxStepsPerCase: 20_000, maxTotalSteps: 30_000 };

export function judgeGraph(graph: FlowGraph, cases: JudgeCase[], expectedInputs: string[]): JudgeReport {
  const v = validateGraph(graph, expectedInputs);
  if (!v.ok || !v.compiled) {
    return { verdict: "invalid_graph", passed: 0, total: cases.length, results: [], issues: v.errors, totalSteps: 0 };
  }
  const results: CaseResult[] = [];
  let totalSteps = 0;
  for (const c of cases) {
    const budget = Math.min(JUDGE_LIMITS.maxStepsPerCase, JUDGE_LIMITS.maxTotalSteps - totalSteps);
    const r =
      budget > 0
        ? runCompiled(v.compiled, c.input, { trace: false, maxSteps: budget })
        : ({
            status: "error",
            steps: 0,
            trace: [],
            traceTruncated: false,
            error: { code: "STEP_LIMIT_EXCEEDED", message: `The judge's budget of ${JUDGE_LIMITS.maxTotalSteps.toLocaleString("en-US")} steps across all tests is used up` },
          } as const);
    totalSteps += r.steps;
    const isPublic = c.visibility === "public";
    const base: CaseResult = { case_id: c.case_id, visibility: c.visibility, status: "passed", steps: r.steps };
    if (r.status === "error") {
      base.status = "runtime_error";
      // Error codes are safe to show; messages may echo private values, so hide them for private cases.
      base.error = isPublic ? r.error : { code: r.error!.code, message: "A runtime error occurred on a hidden test" };
    } else if (!valuesEqual(r.output as Value, c.output)) {
      base.status = "wrong_answer";
    }
    if (isPublic) {
      base.input = c.input;
      base.expected = c.output;
      if (r.status === "ok") base.actual = r.output;
    }
    results.push(base);
  }
  const passed = results.filter((r) => r.status === "passed").length;
  const firstFail = results.find((r) => r.status !== "passed");
  const verdict: Verdict = !firstFail ? "accepted" : firstFail.status === "runtime_error" ? "runtime_error" : "wrong_answer";
  return { verdict, passed, total: cases.length, results, totalSteps };
}
