import { describe, expect, it } from "vitest";
import { evaluate, formatValue, type Env } from "../../src/lib/engine/evaluate";
import { parseExpression } from "../../src/lib/engine/expression";
import { execute } from "../../src/lib/engine/interpreter";
import type { Value } from "../../src/lib/engine/types";
import { buildGraph } from "../helpers/build";

const run = (src: string, vars: Record<string, Value> = {}) => evaluate(parseExpression(src), new Map(Object.entries(vars)) as Env);
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return "NO_ERROR";
};

describe("maps", () => {
  it("builds, reads and queries maps", () => {
    expect(formatValue(run("{}"))).toBe("{}");
    expect(run('{")": "(", "]": "["}["]"]')).toBe("[");
    expect(run("{0: 1}[0]")).toBe(1);
    expect(run('has({"a": 1}, "a")')).toBe(true);
    expect(run('"b" in {"a": 1}')).toBe(false);
    expect(run('get({"a": 1}, "b", 0)')).toBe(0);
    expect(run('keys({"b": 2, "a": 1})')).toEqual(["b", "a"]);
    expect(run('values({"b": 2, "a": 1})')).toEqual([2, 1]);
    expect(run("len({1: true, 2: true})")).toBe(2);
    expect(run('remove({"a": 1, "b": 2}, "a") == {"b": 2}')).toBe(true);
    expect(run("{1: 2} == {1: 2}")).toBe(true);
  });

  it("keeps 1 and \"1\" as different keys", () => {
    expect(run('len({1: "n", "1": "s"})')).toBe(2);
  });

  it("raises typed errors", () => {
    expect(code(() => run('{"a": 1}["b"]'))).toBe("KEY_NOT_FOUND");
    expect(code(() => run("{[1]: 2}"))).toBe("TYPE_MISMATCH");
    expect(code(() => run("has([1], 1)"))).toBe("TYPE_MISMATCH");
  });

  it("supports assignment into maps and copies on assignment", () => {
    const g = buildGraph(["numbers"], [
      { set: "m", to: "{}" },
      { set: "m[numbers[0]]", to: "1" },
      { set: "copy", to: "m" },
      { set: "copy[numbers[0]]", to: "99" },
      { set: "m", to: "remove(m, 5)" },
      { ret: "[m[numbers[0]], copy[numbers[0]], len(m)]" },
    ]);
    expect(execute(g, { numbers: [7] }).output).toEqual([1, 99, 1]);
  });
});

describe("pop and sort", () => {
  it("pop returns the array without its last item", () => {
    expect(run("pop([1, 2, 3])")).toEqual([1, 2]);
    expect(code(() => run("pop([])"))).toBe("INDEX_OUT_OF_RANGE");
  });

  it("sort orders numbers, text and arrays", () => {
    expect(run("sort([3, -1, 2])")).toEqual([-1, 2, 3]);
    expect(run('sort(["b", "a"])')).toEqual(["a", "b"]);
    expect(run("sort([[2, 1], [1, 5], [1, 2]])")).toEqual([[1, 2], [1, 5], [2, 1]]);
    expect(code(() => run('sort([1, "a"])'))).toBe("TYPE_MISMATCH");
  });

  it("in-place pop and remove give the same result as copying", () => {
    const g = buildGraph(["numbers"], [
      { set: "s", to: "numbers" },
      { set: "s", to: "pop(s)" },
      { set: "s", to: "pop(s)" },
      { ret: "[s, numbers]" },
    ]);
    expect(execute(g, { numbers: [1, 2, 3] }).output).toEqual([[1], [1, 2, 3]]);
  });

  it("traces keep a snapshot of maps per step", () => {
    const g = buildGraph(["numbers"], [{ set: "m", to: "{}" }, { set: "m[1]", to: "true" }, { ret: "len(m)" }]);
    const r = execute(g, { numbers: [] }, { trace: true });
    const at = r.trace.filter((t) => "m" in t.vars).map((t) => formatValue(t.vars.m));
    expect(at[0]).toBe("{}");
    expect(at.at(-1)).toBe("{1: true}");
  });
});
