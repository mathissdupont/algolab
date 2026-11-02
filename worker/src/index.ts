// AlgoLab judge: authoritative server-side judging against public + private
// tests. Shares the exact engine the browser uses (src/lib/engine).

import { judgeGraph, type JudgeCase } from "../../src/lib/engine/judge";
import { getProblem, inputNames, isSupported } from "../../src/lib/problems";
import privateSuites from "../private/judge_tests.json";

interface D1Result<T> {
  results: T[];
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}
interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
}

const MAX_BODY_BYTES = 256 * 1024;
const RATE_LIMIT = { windowSeconds: 60, maxSubmissions: 12 };
const suites = privateSuites as unknown as Record<string, JudgeCase[]>;

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  return allowed.includes(origin)
    ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" }
    : {};
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });
}

async function clientHash(req: Request): Promise<string> {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`algolab:${ip}`));
  return [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function submit(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
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
  const cases = suites[problem.slug];
  if (!cases?.length) return json({ error: "No tests are configured for this problem" }, 500, cors);

  const who = await clientHash(req);
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM submissions WHERE client_hash = ? AND created_at > datetime('now', ?)`,
  )
    .bind(who, `-${RATE_LIMIT.windowSeconds} seconds`)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= RATE_LIMIT.maxSubmissions) {
    return json({ error: `Too many submissions — please wait a minute (limit ${RATE_LIMIT.maxSubmissions} per minute)` }, 429, cors);
  }

  let report;
  try {
    report = judgeGraph(body.graph as never, cases, inputNames(problem));
  } catch {
    return json({ error: "Malformed flowchart payload" }, 400, cors);
  }

  const id = crypto.randomUUID();
  const graphVersion = (body.graph as { schema_version?: unknown })?.schema_version;
  await env.DB.prepare(
    `INSERT INTO submissions (id, problem_id, problem_slug, graph_version, graph_json, verdict, passed, total, total_steps, client_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, problem.id, problem.slug, typeof graphVersion === "string" ? graphVersion : null, JSON.stringify(body.graph), report.verdict, report.passed, report.total, report.totalSteps, who)
    .run();

  return json({ submission_id: id, problem_id: problem.id, report }, 200, cors);
}

async function getSubmission(id: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, problem_id, problem_slug, verdict, passed, total, total_steps, created_at FROM submissions WHERE id = ?`,
  )
    .bind(id)
    .first();
  return row ? json(row, 200, cors) : json({ error: "Submission not found" }, 404, cors);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === "/api/health" && req.method === "GET") {
        return json({ ok: true, suites: Object.keys(suites).length }, 200, cors);
      }
      if (url.pathname === "/api/submissions" && req.method === "POST") return await submit(req, env, cors);
      const m = url.pathname.match(/^\/api\/submissions\/([0-9a-f-]{36})$/);
      if (m && req.method === "GET") return await getSubmission(m[1], env, cors);
      return json({ error: "Not found" }, 404, cors);
    } catch (e) {
      console.error(e);
      return json({ error: "Internal error" }, 500, cors);
    }
  },
};
