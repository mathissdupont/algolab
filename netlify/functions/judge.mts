// Netlify Functions adapter for the judge API, with Netlify Blobs storage.

import { getStore } from "@netlify/blobs";
import type { JudgeCase } from "../../src/lib/engine/judge";
import { handleRequest, type SubmissionRecord, type SubmissionStore } from "../../server/handler";
import privateSuites from "../private/judge_tests.json";

const ALLOWED_ORIGINS = ["https://mathissdupont.github.io", "http://localhost:3000", "http://localhost:4173"];

// Stores are opened lazily so endpoints that don't need storage never depend on it.
function blobStore(): SubmissionStore {
  const submissions = () => getStore({ name: "submissions", consistency: "strong" });
  const rate = () => getStore({ name: "rate-limit", consistency: "strong" });
  return {
    async hit(client, windowSeconds) {
      const now = Date.now();
      const prev = ((await rate().get(client, { type: "json" })) as number[] | null) ?? [];
      const recent = prev.filter((t) => now - t < windowSeconds * 1000).concat(now);
      await rate().setJSON(client, recent);
      return recent.length;
    },
    async save(record) {
      await submissions().setJSON(record.id, record);
    },
    async get(id) {
      return (await submissions().get(id, { type: "json" })) as SubmissionRecord | null;
    },
  };
}

export default async (req: Request, context: { ip?: string }) =>
  handleRequest(req, {
    store: blobStore(),
    suites: privateSuites as unknown as Record<string, JudgeCase[]>,
    allowedOrigins: ALLOWED_ORIGINS,
    clientIp: context.ip ?? req.headers.get("x-nf-client-connection-ip") ?? "unknown",
  });

export const config = { path: ["/api/health", "/api/submissions", "/api/submissions/*"] };
