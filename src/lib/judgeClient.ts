import type { JudgeReport } from "./engine/judge";
import type { FlowGraph } from "./engine/types";

/** Base URL of the server-side judge (Cloudflare Worker). Empty = not deployed. */
export const JUDGE_URL = (process.env.NEXT_PUBLIC_JUDGE_URL ?? "").replace(/\/+$/, "");

export interface SubmissionResponse {
  submission_id: string;
  problem_id: string;
  report: JudgeReport;
}

export async function submitToJudge(slug: string, graph: FlowGraph): Promise<SubmissionResponse> {
  const res = await fetch(`${JUDGE_URL}/api/submissions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ problem_slug: slug, graph }),
  });
  if (!res.ok) {
    let message = `Judge returned HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}
