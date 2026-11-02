# AlgoLab — Product and Engineering Implementation Plan

**Language:** English (all product UI, challenges, errors, and documentation)  
**Product type:** Browser-based algorithm design, flowchart execution, debugging, and assessment environment  
**Document status:** Implementation-ready brief; architecture choices are proposals, not an existing implementation

## 1. Product vision

**Promise:** Design an algorithm before writing code. Build a flowchart, execute it step by step, inspect variable changes, test its output, and then translate the same logic into Python.

**Audience:** Computer science / engineering students, programming interview candidates, and instructors. Avoid positioning the product as a tool only for absolute beginners.

**Key difference to validate:** A unified pathway from *problem statement → working visual algorithm → automated tests → debugging → independent Python implementation*.

**Non-goal:** Build another static diagram editor. A diagram that looks correct but cannot be executed or tested is insufficient.

## 2. Core user journey

1. Open the problem catalog; filter by Easy, Medium, Hard, topic, or available engine capabilities.
2. Read the English description, constraints, examples, expected output, and permitted operations.
3. Choose **Flowchart Mode** and drag algorithm nodes into the editor.
4. Connect nodes; fill in typed expressions; get immediate structural validation.
5. Press **Run** to execute a public sample. See the highlighted node, variable table, output, and execution history.
6. Use **Step**, **Continue**, **Reset**, and **Breakpoints** to debug.
7. Press **Submit** for server-side judging against public + private cases; receive status, number of passed tests, and actionable feedback. Never expose private test inputs as a downloadable asset.
8. Optionally switch to **Python Mode** and implement the same problem; compare behaviors, not only final text.
9. Save drafts and review previous submissions on a profile page.

## 3. First working vertical slice (build this first)

**Problem:** `ALG-E002` — Count Even Readings.

**Must work end-to-end:**
- The user opens the problem and sees public examples.
- The user creates an executable flowchart with input, counter, loop, condition, increment, and return.
- A validator checks that edges and node parameters form a valid program.
- A deterministic interpreter runs the graph and exposes a variable-by-variable trace.
- A **Run** action runs the public sample without saving a submission.
- A **Submit** action evaluates the same graph on all five seeded cases, including three private cases, and saves the result.
- A failed test shows the first *public* mismatch; private-case failures show safe summary feedback.

**Definition of done:** Working from a clean browser session, no hand-edited answer keys, no mock `Accepted` states, and repeatable judge results.

## 4. MVP scope: build in capability order, not difficulty order

### Phase A — Runnable foundation

**Deliverables:**
- English landing page, catalog, problem detail page, flowchart workspace.
- Node palette: `Start`, `Input`, `Assign`, `Decision`, `While`, `Output/Return`, `End`.
- Typed values: integer, boolean, string, one-dimensional integer array.
- Expressions: literals, variables, `+ - * // %`, comparison, `and/or/not`, `array[index]`, `length`, basic string access.
- A structural graph validator with typed, labeled connections.
- Interpreter with step snapshots, execution highlighting, and safeguards.
- First ~10 simple problems enabled (feature-gated, not based on difficulty alone).
- Importer for `problem_bank_public.json` plus **private** server-only tests.

**Exit criteria:** A user can solve and submit the first supported problems entirely through flowcharts.

### Phase B — Algorithm workflows

**Deliverables:**
- Array and string mutation, two pointers, nested loops, structured functions.
- Set, map, stack, queue primitives; matrix primitives.
- Tests panel with public cases, output diff, execution history, watch expressions, breakpoints.
- Draft autosave; submission history; problem progress; search and topic filters.
- Flowchart-to-Python generation for supported structured constructs.
- Python editor for comparison, with client-side preview in an isolated worker.
- Enable medium problems only as their required features become available.

**Exit criteria:** A student can solve Two Sum, Binary Search, sliding-window, and array-manipulation problems using an executable flowchart.

### Phase C — Advanced algorithms and launch readiness

**Deliverables:**
- Recursion with stack frames, graph representations, priority queues, advanced DP.
- Performance instrumentation: node execution counts, step count, allocation estimates where meaningful.
- Add hard problems after engine compatibility and QA, not merely because they exist in the seed bank.
- Instructor/admin content review, versioned problem definitions, difficulty/topic calibration.
- Expand test coverage, accessibility, rate limits, observability, security reviews.
- Pilot with students, measure independent problem completion and learning outcomes.

**Exit criteria:** Advanced problems are actually expressible and testable; at least one hard-category graph or DP problem is verified end-to-end.

## 5. Recommended architecture

| Component | Recommendation | Responsibility |
|---|---|---|
| Web | Next.js + TypeScript + Tailwind CSS | Routing, account UI, catalog, workspace |
| Graph UI | `@xyflow/react` | Custom flowchart nodes, handles, edges, zoom/pan |
| State | Zustand or typed React state | Draft graph, run state, timeline, selected variables |
| Program model | Versioned JSON graph + validated intermediate representation (IR) | Single source of truth for execution and generation |
| Local execution | Dedicated Web Worker, pure TypeScript interpreter | Deterministic previews; keep UI responsive |
| Server API | FastAPI | Problems, submissions, progress, admin import |
| Persistence | PostgreSQL + SQLAlchemy/Alembic | Problem versions, tests, users, saved diagrams, submissions |
| Server judge | Isolated, resource-limited execution worker | Run private tests and verify submissions |
| Optional Python preview | Pyodide in Web Worker | Separate Python practice mode; not a trusted judge |

**Important:** React Flow draws graphs; it does **not** execute them. The interpreter and validator must be implemented explicitly. Pyodide executes Python but is not a secure authoritative evaluation service by itself.

**References:** [React Flow custom nodes](https://reactflow.dev/learn/customization/custom-nodes); [Pyodide](https://pyodide.org/en/stable/).

## 6. Flowchart programming model

### Node palette contract

| Node type | Inputs | Outgoing edges | Behavior |
|---|---|---|---|
| Start | None | `next` | Enters graph exactly once |
| Input | Named typed bindings | `next` | Binds judge-supplied JSON values to variables |
| Assign | Target + typed expression | `next` | Updates one variable or array element |
| Decision | Boolean expression | `true`, `false` | Selects exactly one branch |
| While | Boolean condition | `body`, `exit` | Re-evaluates until false; body must loop back |
| Return | Expression | None | Terminates with a typed output |
| End | None | None | Terminates (requires explicit output contract) |

**Graph validation rules:** Exactly one reachable `Start`; node IDs unique; edge labels valid; no dangling mandatory connections; all referenced variables defined on every applicable path; expressions typed; conditional edges explicit; return reachable; prohibit unsupported unstructured jumps. Decide whether `End` without `Return` is legal per problem output type; for MVP, prefer `Return` to avoid ambiguous grading.

### Interpreter behavior

- Validate JSON payload and version before execution.
- Parse a small expression grammar; **never** use JavaScript `eval` or `new Function` on user-authored expressions.
- Execute one node transition per logical step; store `(nodeId, variableSnapshot, output, stepCount)`.
- Cap nodes, expression depth, collection size, call depth, total transitions, wall time, and memory; return typed errors such as `STEP_LIMIT_EXCEEDED`, `UNDEFINED_VARIABLE`, `INDEX_OUT_OF_RANGE`, `TYPE_MISMATCH`.
- Evaluate fresh state for every test case. The graph cannot access system files, environment variables, network services, or the answer key.
- The server judge should share the same **versioned semantics** as the client interpreter; ideally share a TypeScript core or use conformance fixtures across implementations.
- Capture trace only up to a configured limit; never ship massive traces in submission responses.

## 7. Problem-bank contract

The handoff package includes **60 English problems** (20 Easy, 20 Medium, 20 Hard), with **300 precomputed test cases** (2 public + 3 private per problem). These are curated starter cases, not production-strength hidden-test coverage.

Each public problem contains:

```json
{
  "id": "ALG-E002",
  "slug": "count-even",
  "title": "Count Even Readings",
  "difficulty": "Easy",
  "category": "Loops",
  "required_engine_tier": "foundation",
  "required_features": ["variables", "comparisons", "loops", "arrays"],
  "statement": "Count how many numbers are divisible by two...",
  "input_schema": {"type": "object", "properties": {"numbers": {"type": "array", "items": {"type": "integer"}}}},
  "output_schema": {"type": "integer"},
  "constraints": ["0 <= length <= 1000"],
  "sample_cases": [{"case_id": "ALG-E002-T01", "input": {"numbers": [3, 8, 5, 12, 7, 6]}, "output": 3}]
}
```

The real files include complete required fields, full statements, constraints, and two samples. The full test suite lives separately in `judge_tests_private.json`, with answer keys computed by the reference implementations in `reference_solutions.py`.

**Security rule:** Never import `judge_tests_private.json` or `reference_solutions.py` into client bundles, public Git repositories, static hosting folders, or public API responses. Replace seeded private cases with larger QA-reviewed private suites before a public launch. Treat the source ZIP as a developer handoff, not a public asset.

**QA rule:** Validate constraints, determinism, corner cases, and difficulty individually; run randomized/property-based tests against independent oracles where practical. Example outputs in the public JSON must always match the authoritative judge.

## 8. Suggested database tables

- `users`: id, email, display_name, created_at.
- `problems`: id, slug, difficulty, category, title, published_version, enabled, engine_tier, description_json.
- `problem_tests`: id, problem_id, version, input_json, expected_json, visibility, weight.
- `flowchart_drafts`: id, user_id, problem_id, graph_json, graph_version, updated_at.
- `submissions`: id, user_id, problem_id, problem_version, graph_version, graph_json, status, passed_count, total_count, step_count, submitted_at.
- `problem_progress`: user_id, problem_id, best_status, attempts, last_solved_at.

Use a compound uniqueness constraint on problem IDs and versioned content, and database migrations. Never infer user progress from local browser-only state.

## 9. API contract (initial)

| Endpoint | Method | Behavior |
|---|---|---|
| `/api/problems` | GET | Paginated public catalog, filters |
| `/api/problems/{slug}` | GET | Public problem and public samples; no private tests |
| `/api/flows/validate` | POST | Structural/type validation and actionable errors |
| `/api/flows/run` | POST | Run **public** samples with trace; enforce limits |
| `/api/submissions` | POST | Authoritative judge with all tests; store result |
| `/api/submissions/{id}` | GET | Status and safe feedback, not private answer keys |
| `/api/me/drafts/{slug}` | PUT/GET | Save and load versioned flow JSON |
| `/api/admin/problems/import` | POST | Authenticated import of public data + private test suites |

Require authentication for saving and submitting; anonymous users may solve a limited selection locally. Put request size limits and submission rate limits on the server.

## 10. UX specification

**Problem catalog:** search, difficulty chips, topic, engine support, completion status. Cards show title, one-line task, difficulty, tags, and estimated effort; no leaked solution text.

**Workspace (desktop):** left ~26% problem and examples; center ~52% flowchart editor; right ~22% variables, outline, tests. Collapsible panes for smaller screens. On mobile, use tabs instead of forcing three tiny columns.

**Node editing:** clear typing, autocomplete for known variables, explicit branch ports, connection validation and keyboard accessibility. Support undo/redo, fit-to-screen, copy/paste, zoom, autosave.

**Execution:** active node highlight, run/pause/step/reset, timeline controls, watched variable values, input preview, output diff, meaningful error messages.

**Learning feedback:** hints should guide reasoning, not paste a solution immediately; compare execution trace to expected behavior on public examples. Explain Big-O qualitatively; do not claim universal automatic Big-O classification based only on a few executions.

**Visual tone:** clean IDE meets modern learning platform; dark/light mode, readable typography, restrained color by semantics, English everywhere.

## 11. Project structure

```text
algolab/
  apps/
    web/
      app/(public)/problems/
      app/(workspace)/solve/[slug]/
      components/flowchart/
      components/execution/
      components/problems/
      lib/api/
      lib/flow-ir/
      workers/interpreter.worker.ts
    api/
      app/main.py
      app/routes/{problems,submissions,flows,auth}.py
      app/models/
      app/services/judge/
      migrations/
  packages/
    flow-schema/              # Zod / JSON Schema, versioned
    interpreter/              # Pure evaluation core + conformance fixtures
    problem-types/
  content/
    problems/problem_bank_public.json
  private/                    # Server-only; excluded from client artifacts
    judge_tests_private.json
    reference_solutions.py
  tests/
    unit/
    integration/
    end-to-end/
  docs/
    IMPLEMENTATION_PLAN.md
    API.md
    FLOW_IR.md
    SECURITY.md
```

## 12. Milestone-oriented backlog

### M0 — Repository and contracts
- Monorepo, TypeScript strict mode, API lint/test, CI, formatter, schema versioning.
- Define value types, node contracts, edge contracts, and sample graph JSON.
- Import seed data into local dev database with consistent IDs.

### M1 — Editor and graph validation
- Canvas, palette, drag/drop, connectors, node property panel, undo/redo.
- Validate missing Start/Return and invalid branches. Save/reload graph.
- Use stable IDs independent of visual positions.

### M2 — Interpreter and stepper
- Execute assignment, comparisons, branching, loops, return on scalar and array inputs.
- Deterministic snapshots and debug stepping.
- Test execution caps and error handling.

### M3 — Automatic judge
- Public sample runs, server-only private runs, saved submissions, errors.
- Pass/fail on real graph execution, no hard-coded success states.
- Run end-to-end acceptance scenario for Count Even Readings.

### M4 — Problem expansion and Python bridge
- Set/map/stack/matrix support where required; enable supported problem subset.
- Python output generation and editor with visible caveats for unsupported constructs.
- Progress dashboard and responsive polish.

### M5 — Production hardening and pilot
- Feature support for advanced problems, content QA, test strengthening.
- Security review, performance, accessibility, logs, rate limiting, student feedback.

## 13. Acceptance checklist

- [ ] Each public problem loads from JSON/API and displays English title, statement, input/output contract, constraints and samples.
- [ ] Dragging a node never silently changes program semantics.
- [ ] Graphs with unconnected required handles cannot be submitted.
- [ ] Every run is deterministic with the same input and graph version.
- [ ] A deliberate infinite loop stops with a visible, typed error.
- [ ] No user-authored expression is directly evaluated as JS/Python code inside the authoritative flowchart engine.
- [ ] Server submissions are judged against private cases, and private tests remain server-only.
- [ ] At least the Count Even Readings sample and hidden tests pass with a real flowchart.
- [ ] Empty inputs, negative integers, duplicate elements, and boundary constraints are tested where applicable.
- [ ] The UI remains usable on laptop and mobile sizes; basic keyboard access works.
- [ ] Engine-incompatible problems are explicitly disabled/marked upcoming rather than falsely offered as solvable.
- [ ] No performance percentile, time complexity, or learning outcome is fabricated.

## 14. Product validation metrics

Track: time to first executable flowchart, first sample-pass rate, percentage of problems solved without hints, number of failed runs before success, day-7 voluntary return rate, and independent Python re-solve success. Pilot with consenting students; compare progress on **new** unseen problems, not just repeated examples.

## 15. Avoid premature scope

Do **not** start with multiplayer, leaderboards, AI-generated answers, badges, certificate delivery, mobile native apps, 60 simultaneously enabled problems, or language support beyond English. First prove the editable graph can **execute and judge** real algorithms.
