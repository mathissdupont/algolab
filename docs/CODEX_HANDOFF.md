# AlgoLab — Engineering Agent Handoff

Paste this brief into your coding agent together with the files in this directory. The product language must be **English**.

## Mission

Build an actual browser-based algorithm-learning platform where users read programming challenges, create executable flowcharts, step through variable changes, and receive automated test results. The system must also support later progression to Python code, but the initial implementation should deliver a genuinely runnable flowchart editor rather than mock interactions.

## Supplied artifacts

- `IMPLEMENTATION_PLAN.md` — detailed product, architecture, milestones, security, UI, and definition of done.
- `problem_bank_public.json` — 60 ready-to-import English problem descriptions, schemas, two sample cases each.
- `judge_tests_private.json` — 300 authoritative seed tests; **never send to browser**.
- `reference_solutions.py` — internal reference implementations used to generate/verify expected results; **never bundle in frontend**.
- `build_problem_bank.py` — deterministic generator; developer-only.
- `PROBLEM_INDEX.md` — complete public title and category catalog.
- `MVP_PROBLEMS.md` — launch sequence guided by engine features.
- `FLOW_IR_EXAMPLE.json` — illustrative Count Even Readings graph for schema design; not yet executable.
- `validate_problem_bank.py` — seed consistency checker.

## Non-negotiable engineering rules

1. Start with the single vertical slice `ALG-E002 / count-even` and complete it end-to-end before adding broad feature scope.
2. English-only UI and problem text.
3. Use custom React Flow nodes for drawing and a **separate typed graph interpreter** for execution; never confuse graph rendering with graph execution.
4. No arbitrary `eval` or `Function` of user-defined expressions. Parse a restricted expression grammar.
5. Do not claim a problem is passed without actually executing the submitted graph against judge cases.
6. Keep private test cases and reference solutions on the backend. Public APIs return two samples and metadata only.
7. Add max graph size, maximum step count, runtime and memory limits, recursion limits, and rate limiting.
8. Show unsupported problems as "Coming soon" until required engine features exist; content is ready, engine capability is not.
9. Write unit, integration, and end-to-end tests for each milestone. Add tests for invalid graphs and infinite loops.
10. Do not quietly skip broken features, alter expected outputs, or manufacture screenshot/demo states.

## First coding tasks

1. Initialize Next.js/TypeScript frontend, FastAPI backend, and local PostgreSQL with a documented run command.
2. Define a versioned JSON flowchart schema (Start/Input/Assign/Decision/While/Return) and expression AST.
3. Implement the flowchart workspace: problem panel, canvas, node palette, properties panel, run controls, debug pane.
4. Implement structural graph validation and one-step-at-a-time interpreter, first for integers, comparisons, loops, arrays.
5. Implement local sample running and server-only submission judging.
6. Import `ALG-E002` and solve it with an actual flowchart; record traces and verify all 5 seeded tests.
7. Only then unlock additional problems and engine features.

## What to return after each work package

- Files created/changed; how to run; actual test output; completed/blocked acceptance criteria; remaining technical risks.
- Working UI screenshot for implemented features only, with no fake 'Accepted' state.
- Clear next tasks rather than an unverified claim that the complete platform is done.

## Initial validation commands

```bash
python build_problem_bank.py
python validate_problem_bank.py
```

Read and follow `IMPLEMENTATION_PLAN.md` before proposing extra features.
