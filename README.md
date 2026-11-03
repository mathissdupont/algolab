# AlgoLab

**Design the algorithm before you write the code.** AlgoLab is a browser-based environment where you solve algorithm problems by building a flowchart that actually runs. You can step through it node by node, watch every variable change, and submit it to a judge that also runs hidden tests.

- **Live site:** https://mathissdupont.github.io/algolab/
- **Status:** early access. All 60 problems can be solved. Each one has a reference flowchart that passes its public and hidden seed tests.

## What works

| Area | Status |
|---|---|
| Flowchart editor | Start / Input / Assign / Decision / While / Return nodes, drag & drop, click-to-insert-after, connect/replace ports, delete, undo/redo, autosave in the browser |
| Expression language | Python-like, parsed into an AST (never `eval`). Integers, floats, booleans, strings, nested arrays, maps, `// %` with Python semantics, `in`, indexing, 21 built-ins including `sort`, `pop`, `has`, `get` and `keys`. See the in-app **Guide** |
| Validation | One Start, ports connected, reachability, While bodies loop back, parse errors, and “variable may be used before it is assigned” (definite-assignment analysis) |
| Execution | Deterministic interpreter in a Web Worker, with a full variable trace, step forward and back, breakpoints, a timeline, and typed errors (`STEP_LIMIT_EXCEEDED`, `INDEX_OUT_OF_RANGE`, `TYPE_MISMATCH`, …) |
| Judging | **Check examples** runs the public samples in the browser. **Submit** sends the flowchart to the judge (a Netlify Function), which runs the public and private tests and stores the submission in Netlify Blobs |
| Feature gating | A problem can be opened only when its engine tier and all `required_features` are implemented ([src/lib/problems.ts](src/lib/problems.ts)) |

Not built yet: user accounts, progress tracking, Python mode, and the engine features that the remaining 42 problems need. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the full roadmap.

## Architecture

```
src/lib/engine/        Flow IR types, expression parser, evaluator, validator, interpreter, judge
                       (pure TypeScript, shared by the browser and the judge)
src/lib/flow/          React Flow <-> Flow IR conversion, starter graphs, draft storage
src/lib/runner.ts      Runs the engine in a Web Worker (src/lib/engine.worker.ts)
src/components/flow/   Workspace, custom nodes, Inspector, Debug and Tests panels
src/app/               Next.js App Router pages (static export)
content/problems/      Public problem bank (statements + 2 samples each)
server/handler.ts      Platform-agnostic judge API (validation, rate limit, judging, storage interface)
netlify/functions/     Netlify Functions adapter (Netlify Blobs storage)
tests/unit, tests/e2e  Vitest engine tests, Playwright end-to-end tests
```

React Flow only draws the graph. Before validation or execution, the graph is converted into a versioned **Flow IR** ([docs/FLOW_IR.md](docs/FLOW_IR.md)). The browser and the judge run the same engine code, so a flowchart behaves the same way in both places.

### Private test data

The private tests and reference solutions are **not in this repository**, and they are never included in the static site. `netlify/private/` is gitignored. Only `netlify deploy` uploads it, from a developer machine, into the function bundle. The judge reports only pass/fail and an error code for hidden tests. It never returns their inputs or expected outputs.

## Development

Requires Node 20+.

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # engine unit tests
npm run typecheck
```

End-to-end tests run against the production build, served under `/algolab` the same way GitHub Pages serves it:

```bash
npx playwright install chromium
NEXT_PUBLIC_BASE_PATH=/algolab npm run build
npm run test:e2e
```

To try the judge API locally:

```bash
node server/import-private-tests.mjs path/to/judge_tests_private.json
npx netlify-cli@26 dev            # serves /api/* on http://localhost:8888
# in another shell:
NEXT_PUBLIC_JUDGE_URL=http://localhost:8888 npm run dev
```

## Deployment

- **Site:** every push to `main` builds the static export and publishes it to GitHub Pages ([.github/workflows/pages.yml](.github/workflows/pages.yml)). The build reads the judge URL from the repository variable `JUDGE_URL`. If that variable is empty, **Submit** falls back to checking the public examples only, and the UI says so.
- **Judge:** deployed manually from a machine that has the private tests:

  ```bash
  node server/import-private-tests.mjs path/to/judge_tests_private.json
  npx netlify-cli@26 login
  npx netlify-cli@26 deploy --prod      # first time: link/create the site
  gh variable set JUDGE_URL --body "https://<site>.netlify.app"
  ```

  The judge runs on Netlify because `*.workers.dev` and `*.vercel.app` are blocked by some Turkish ISPs, and `*.netlify.app` is reachable.

Both run on free tiers. The judge caps each submission at 3,000,000 interpreter steps (1,000,000 per test). The heaviest reference flowchart, N-Queens with iterative backtracking, needs about 280,000 steps on its largest seed test; most need fewer than 1,000. Submissions are rate-limited to 12 per minute per client.

## Limits

- Interactive runs: 1,000,000 steps / 3 s. Judge: 1,000,000 steps per test, 3,000,000 per submission.
- Flowcharts: 150 nodes, 300 connections, 400-character expressions.
- The 300 seed tests (2 public + 3 hidden per problem) are a starting point. They are not production-strength judge coverage.
