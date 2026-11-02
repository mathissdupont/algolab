import { describe, expect, it } from "vitest";
import type { JudgeCase } from "../../src/lib/engine/judge";
import { handleRequest, type SubmissionRecord, type SubmissionStore } from "../../server/handler";
import { buildGraph } from "../helpers/build";

// Fake suites only: the real private tests never live in the repository.
const suites: Record<string, JudgeCase[]> = {
  "count-even": [
    { case_id: "pub", input: { numbers: [3, 8, 5, 12, 7, 6] }, output: 3, visibility: "public" },
    { case_id: "hid", input: { numbers: [2, 4] }, output: 2, visibility: "private" },
  ],
};

function memoryStore(): SubmissionStore {
  const subs = new Map<string, SubmissionRecord>();
  const hits = new Map<string, number>();
  return {
    async hit(client) {
      const n = (hits.get(client) ?? 0) + 1;
      hits.set(client, n);
      return n;
    },
    async save(r) {
      subs.set(r.id, r);
    },
    async get(id) {
      return subs.get(id) ?? null;
    },
  };
}

const countEven = buildGraph(["numbers"], [
  { set: "count", to: "0" },
  { set: "i", to: "0" },
  { while: "i < len(numbers)", do: [{ if: "numbers[i] % 2 == 0", then: [{ set: "count", to: "count + 1" }] }, { set: "i", to: "i + 1" }] },
  { ret: "count" },
]);

const origin = "https://mathissdupont.github.io";
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://judge.test/api/submissions", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("judge API", () => {
  const deps = () => ({ store: memoryStore(), suites, allowedOrigins: [origin], clientIp: "1.2.3.4" });

  it("judges public and private cases, stores the submission, hides private details", async () => {
    const d = deps();
    const res = await handleRequest(post({ problem_slug: "count-even", graph: countEven }, { origin }), d);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    const body = await res.json();
    expect(body.report).toMatchObject({ verdict: "accepted", passed: 2, total: 2 });
    expect(body.report.results[1]).toEqual({ case_id: "hid", visibility: "private", status: "passed", steps: expect.any(Number) });

    const get = await handleRequest(new Request(`https://judge.test/api/submissions/${body.submission_id}`), d);
    expect(await get.json()).toMatchObject({ problem_id: "ALG-E002", verdict: "accepted", passed: 2 });
  });

  it("rejects unknown, unsupported and malformed submissions", async () => {
    expect((await handleRequest(post({ problem_slug: "nope", graph: {} }), deps())).status).toBe(404);
    expect((await handleRequest(post({ problem_slug: "distinct-count", graph: {} }), deps())).status).toBe(400);
    const bad = await handleRequest(post({ problem_slug: "count-even", graph: { schema_version: "1.0", nodes: [5], edges: [null] } }), deps());
    expect(bad.status).toBe(400);
  });

  it("rate-limits a client and ignores foreign origins for CORS", async () => {
    const d = deps();
    const codes = [];
    for (let k = 0; k < 13; k++) codes.push((await handleRequest(post({ problem_slug: "count-even", graph: countEven }), d)).status);
    expect(codes.slice(0, 12).every((c) => c === 200)).toBe(true);
    expect(codes[12]).toBe(429);
    const foreign = await handleRequest(new Request("https://judge.test/api/health", { headers: { origin: "https://evil.example" } }), d);
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
  });
});
