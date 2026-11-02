// Platform-agnostic judge API: authoritative judging against public + private
// tests using the exact engine the browser runs (src/lib/engine).

import { judgeGraph, type JudgeCase, type Verdict } from "../src/lib/engine/judge";
import { getProblem, inputNames, isSupported } from "../src/lib/problems";

export interface SubmissionRecord {
  id: string;
  problem_id: string;
  problem_slug: string;
  graph_version: string | null;
  graph_json: string;
  verdict: Verdict;
  passed: number;
  total: number;
  total_steps: number;
  client_hash: string;
  created_at: string;
}

export interface SubmissionStore {
  /** Records one attempt for `client` and returns how many it made in the window (including this one). */
  hit(client: string, windowSeconds: number): Promise<number>;
  save(record: SubmissionRecord): Promise<void>;
  get(id: string): Promise<SubmissionRecord | null>;
}

export interface HandlerDeps {
  store: SubmissionStore;
  suites: Record<string, JudgeCase[]>;
  allowedOrigins: string[];
  clientIp: string;
}

const MAX_BODY_BYTES = 256 * 1024;
const RATE_LIMIT = { windowSeconds: 60, maxSubmissions: 12 };

function corsHeaders(req: Request, allowed: string[]): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return allowed.includes(origin)
    ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" }
    : {};
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });
}

async function hashClient(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`algolab:${ip}`));
  return [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function submit(req: Request, deps: HandlerDeps, cors: Record<string, string>): Promise<Response> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "Flowchart is too large" }, 413, cors);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: "Flowchart is too large" }, 413, cors);

  let body: { problem_slug?: unknown; graph?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Request body must be JSON" }, 400, cors);
  }
  const problem = typeof body.problem_slug === "string" ? getProblem(body.problem_slug) : undefined;
  if (!problem) return json({ error: "Unknown problem" }, 404, cors);
  if (!isSupported(problem)) return json({ error: "This problem is not judgeable yet" }, 400, cors);
  const cases = deps.suites[problem.slug];
  if (!cases?.length) return json({ error: "No tests are configured for this problem" }, 500, cors);

  const who = await hashClient(deps.clientIp);
  if ((await deps.store.hit(who, RATE_LIMIT.windowSeconds)) > RATE_LIMIT.maxSubmissions) {
    return json({ error: `Too many submissions — please wait a minute (limit ${RATE_LIMIT.maxSubmissions} per minute)` }, 429, cors);
  }

  let report;
  try {
    report = judgeGraph(body.graph as never, cases, inputNames(problem));
  } catch {
    return json({ error: "Malformed flowchart payload" }, 400, cors);
  }

  const version = (body.graph as { schema_version?: unknown })?.schema_version;
  const record: SubmissionRecord = {
    id: crypto.randomUUID(),
    problem_id: problem.id,
    problem_slug: problem.slug,
    graph_version: typeof version === "string" ? version : null,
    graph_json: JSON.stringify(body.graph),
    verdict: report.verdict,
    passed: report.passed,
    total: report.total,
    total_steps: report.totalSteps,
    client_hash: who,
    created_at: new Date().toISOString(),
  };
  await deps.store.save(record);
  return json({ submission_id: record.id, problem_id: problem.id, report }, 200, cors);
}

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  const cors = corsHeaders(req, deps.allowedOrigins);
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    if (url.pathname === "/api/health" && req.method === "GET") {
      return json({ ok: true, suites: Object.keys(deps.suites).length }, 200, cors);
    }
    if (url.pathname === "/api/submissions" && req.method === "POST") return await submit(req, deps, cors);
    const m = url.pathname.match(/^\/api\/submissions\/([0-9a-f-]{36})$/);
    if (m && req.method === "GET") {
      const r = await deps.store.get(m[1]);
      if (!r) return json({ error: "Submission not found" }, 404, cors);
      const { id, problem_id, problem_slug, verdict, passed, total, total_steps, created_at } = r;
      return json({ id, problem_id, problem_slug, verdict, passed, total, total_steps, created_at }, 200, cors);
    }
    return json({ error: "Not found" }, 404, cors);
  } catch (e) {
    console.error(e);
    return json({ error: "Internal error" }, 500, cors);
  }
}
