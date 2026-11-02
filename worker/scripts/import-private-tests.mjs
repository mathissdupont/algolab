// Converts the handoff's judge_tests_private.json into the Worker's private
// test file. The output is gitignored and only ever uploaded by `wrangler deploy`.
//   node worker/scripts/import-private-tests.mjs <path/to/judge_tests_private.json>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) {
  console.error("usage: node worker/scripts/import-private-tests.mjs <judge_tests_private.json>");
  process.exit(1);
}
const { test_suites } = JSON.parse(readFileSync(src, "utf8"));
const out = {};
for (const suite of test_suites) {
  out[suite.slug] = suite.cases.map((c) => ({
    case_id: c.case_id,
    input: c.input,
    output: c.expected,
    visibility: c.visibility === "public" ? "public" : "private",
  }));
}
const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "private", "judge_tests.json");
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out));
const n = Object.values(out).reduce((a, cs) => a + cs.length, 0);
console.log(`wrote ${Object.keys(out).length} suites / ${n} cases to ${dest}`);
