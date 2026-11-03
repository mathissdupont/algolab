import { describe, expect, it } from "vitest";
import { execute } from "../../src/lib/engine/interpreter";
import { JUDGE_LIMITS, judgeGraph, type JudgeCase } from "../../src/lib/engine/judge";
import { FLOW_SCHEMA_VERSION, type FlowGraph } from "../../src/lib/engine/types";
import { validateGraph } from "../../src/lib/engine/validate";
import { getProblem } from "../../src/lib/problems";
import flowIrExample from "../../docs/FLOW_IR_EXAMPLE.json";
import { buildGraph } from "../helpers/build";

// The handoff's illustrative ALG-E002 graph, converted to the v1 schema.
const countEven: FlowGraph = {
  schema_version: FLOW_SCHEMA_VERSION,
  nodes: flowIrExample.nodes.map((n) => ({ id: n.id, kind: n.kind as never, data: n.data })),
  edges: flowIrExample.edges,
};

describe("interpreter", () => {
  it("runs the ALG-E002 vertical slice graph with a trace", () => {
    const r = execute(countEven, { numbers: [3, 8, 5, 12, 7, 6] }, { trace: true });
    expect(r.status).toBe("ok");
    expect(r.output).toBe(3);
    expect(r.trace[0].nodeId).toBe("start");
    expect(r.trace.at(-1)!.nodeId).toBe("return");
    expect(r.trace.at(-1)!.vars).toMatchObject({ count: 3, index: 6 });
    const firstDecision = r.trace.find((t) => t.nodeId === "is_even")!;
    expect(firstDecision.note).toBe("condition is false → false");
  });

  it("is deterministic", () => {
    const a = execute(countEven, { numbers: [2, 4, 5] }, { trace: true });
    const b = execute(countEven, { numbers: [2, 4, 5] }, { trace: true });
    expect(a).toEqual(b);
  });

  it("passes all ALG-E002 public samples through the judge", () => {
    const p = getProblem("count-even")!;
    const cases: JudgeCase[] = p.sample_cases.map((c) => ({ ...c, visibility: "public" }));
    const report = judgeGraph(countEven, cases, ["numbers"]);
    expect(report.verdict).toBe("accepted");
    expect(report.passed).toBe(2);
  });

  it("stops an infinite loop with STEP_LIMIT_EXCEEDED", () => {
    const g = buildGraph(["numbers"], [{ set: "i", to: "0" }, { while: "i < 1", do: [{ set: "i", to: "i * 1" }] }, { ret: "i" }]);
    const r = execute(g, { numbers: [] }, { maxSteps: 5000 });
    expect(r.status).toBe("error");
    expect(r.error!.code).toBe("STEP_LIMIT_EXCEEDED");
  });

  it("reports runtime errors with the failing node", () => {
    const g = buildGraph(["numbers"], [{ ret: "numbers[10]" }]);
    const r = execute(g, { numbers: [1] });
    expect(r.error).toMatchObject({ code: "INDEX_OUT_OF_RANGE", nodeId: "return1" });
  });

  it("copies arrays on assignment and mutates elements in place", () => {
    const g = buildGraph(["numbers"], [
      { set: "copy", to: "numbers" },
      { set: "copy[0]", to: "99" },
      { set: "out", to: "[]" },
      { set: "out", to: "append(out, numbers[0])" },
      { set: "out", to: "append(out, copy[0])" },
      { ret: "out" },
    ]);
    expect(execute(g, { numbers: [1, 2] }).output).toEqual([1, 99]);
  });

  it("does not leak state between judge cases", () => {
    const g = buildGraph(["numbers"], [{ set: "numbers[0]", to: "numbers[0] + 1" }, { ret: "numbers[0]" }]);
    const cases: JudgeCase[] = [
      { case_id: "a", input: { numbers: [1] }, output: 2, visibility: "public" },
      { case_id: "b", input: { numbers: [1] }, output: 2, visibility: "public" },
    ];
    expect(judgeGraph(g, cases, ["numbers"]).passed).toBe(2);
  });

  it("enforces the judge step budget across cases", () => {
    const g = buildGraph(["numbers"], [{ set: "i", to: "0" }, { while: "i < 1", do: [{ set: "i", to: "i * 1" }] }, { ret: "i" }]);
    const cases: JudgeCase[] = [1, 2, 3].map((k) => ({ case_id: `c${k}`, input: { numbers: [] }, output: 0, visibility: "public" }));
    const report = judgeGraph(g, cases, ["numbers"]);
    expect(report.verdict).toBe("runtime_error");
    expect(report.results.map((r) => r.error?.code)).toEqual(["STEP_LIMIT_EXCEEDED", "STEP_LIMIT_EXCEEDED", "STEP_LIMIT_EXCEEDED"]);
    expect(report.totalSteps).toBeLessThanOrEqual(JUDGE_LIMITS.maxTotalSteps + 3);
  });

  it("hides private case details in judge reports", () => {
    const g = buildGraph(["numbers"], [{ ret: "0" }]);
    const cases: JudgeCase[] = [
      { case_id: "pub", input: { numbers: [2] }, output: 1, visibility: "public" },
      { case_id: "priv", input: { numbers: [4] }, output: 1, visibility: "private" },
    ];
    const report = judgeGraph(g, cases, ["numbers"]);
    expect(report.verdict).toBe("wrong_answer");
    expect(report.results[0]).toMatchObject({ expected: 1, actual: 0 });
    expect(report.results[1]).not.toHaveProperty("input");
    expect(report.results[1]).not.toHaveProperty("expected");
    expect(report.results[1]).not.toHaveProperty("actual");
  });
});

describe("validator", () => {
  const issues = (g: FlowGraph, inputs = ["numbers"]) => validateGraph(g, inputs).errors.map((e) => e.message).join("\n");

  it("accepts a valid graph", () => {
    expect(validateGraph(countEven, ["numbers"]).ok).toBe(true);
  });

  it("requires Start, Return and connected ports", () => {
    const g: FlowGraph = { schema_version: FLOW_SCHEMA_VERSION, nodes: [{ id: "a", kind: "assign", data: { target: "x", expression: "1" } }], edges: [] };
    const msg = issues(g, []);
    expect(msg).toContain("needs a Start node");
    expect(msg).toContain("at least one Return");
    expect(msg).toContain("needs a 'next' connection");
  });

  it("rejects duplicate ports, bad ports and edges into Start", () => {
    const g = structuredClone(countEven);
    g.edges.push({ from: "count", port: "next", to: "loop" });
    g.edges.push({ from: "count", port: "true", to: "loop" });
    g.edges.push({ from: "loop", port: "body", to: "start" });
    const msg = issues(g);
    expect(msg).toContain("more than one 'next'");
    expect(msg).toContain("no 'true' output");
    expect(msg).toContain("into the Start node");
  });

  it("flags variables that may be unassigned on some path", () => {
    const g = buildGraph(["numbers"], [
      { if: "len(numbers) > 0", then: [{ set: "x", to: "1" }] },
      { ret: "x" },
    ]);
    expect(issues(g)).toContain("'x' may be used before it is assigned");
  });

  it("accepts variables assigned on every branch and inside loops", () => {
    const g = buildGraph(["numbers"], [
      { if: "len(numbers) > 0", then: [{ set: "x", to: "1" }], else: [{ set: "x", to: "2" }] },
      { set: "i", to: "0" },
      { while: "i < 3", do: [{ set: "i", to: "i + x" }] },
      { ret: "i" },
    ]);
    expect(validateGraph(g, ["numbers"]).ok).toBe(true);
  });

  it("flags unreachable nodes and missing inputs", () => {
    const g = structuredClone(countEven);
    g.nodes.push({ id: "orphan", kind: "return", data: { expression: "0" } });
    expect(issues(g)).toContain("not reachable");
    expect(issues(countEven, ["numbers", "target"])).toContain("must bind: target");
  });

  it("flags While loops whose body never returns", () => {
    const g: FlowGraph = {
      schema_version: FLOW_SCHEMA_VERSION,
      nodes: [
        { id: "s", kind: "start", data: {} },
        { id: "w", kind: "while", data: { condition: "true" } },
        { id: "r1", kind: "return", data: { expression: "1" } },
        { id: "r2", kind: "return", data: { expression: "2" } },
      ],
      edges: [
        { from: "s", port: "next", to: "w" },
        { from: "w", port: "body", to: "r1" },
        { from: "w", port: "exit", to: "r2" },
      ],
    };
    expect(issues(g, [])).toContain("never leads back");
  });

  it("reports expression syntax errors on the node", () => {
    const g = buildGraph(["numbers"], [{ ret: "count +" }]);
    const r = validateGraph(g, ["numbers"]);
    expect(r.errors[0]).toMatchObject({ nodeId: "return1" });
    expect(r.errors[0].message).toContain("Return expression");
  });
});
