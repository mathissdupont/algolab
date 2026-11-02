import { describe, expect, it } from "vitest";
import { evaluate, type Env } from "../../src/lib/engine/evaluate";
import { parseExpression, parseTarget } from "../../src/lib/engine/expression";
import type { Value } from "../../src/lib/engine/types";

const run = (src: string, vars: Record<string, Value> = {}) => evaluate(parseExpression(src), new Map(Object.entries(vars)) as Env);
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return "NO_ERROR";
};

describe("expression language", () => {
  it("follows Python integer semantics for // and %", () => {
    expect(run("7 // 2")).toBe(3);
    expect(run("-7 // 2")).toBe(-4);
    expect(run("-7 % 3")).toBe(2);
    expect(run("7 % -3")).toBe(-2);
    expect(run("-4 % 2")).toBe(0);
    expect(run("7 / 2")).toBe(3.5);
  });

  it("respects precedence and parentheses", () => {
    expect(run("2 + 3 * 4")).toBe(14);
    expect(run("(2 + 3) * 4")).toBe(20);
    expect(run("-2 * -3")).toBe(6);
    expect(run("not 1 < 2 or true and false")).toBe(false);
  });

  it("indexes arrays and strings, including negative indexes", () => {
    expect(run("xs[1]", { xs: [5, 6, 7] })).toBe(6);
    expect(run("xs[-1]", { xs: [5, 6, 7] })).toBe(7);
    expect(run("s[0]", { s: "abc" })).toBe("a");
    expect(run("grid[1][0]", { grid: [[1, 2], [3, 4]] })).toBe(3);
  });

  it("supports built-ins", () => {
    expect(run("len(xs) + length('ab')", { xs: [1, 2, 3] })).toBe(5);
    expect(run("append([1], 2)")).toEqual([1, 2]);
    expect(run("max(3, 9, 4)")).toBe(9);
    expect(run("min([4, -1, 2])")).toBe(-1);
    expect(run("str(15) + 'x'")).toBe("15x");
    expect(run("lower('A') in 'aeiou'")).toBe(true);
    expect(run("'z' not in 'aeiou'")).toBe(true);
    expect(run("slice('hello', 1, 3)")).toBe("el");
    expect(run("array(3, 0)")).toEqual([0, 0, 0]);
    expect(run("int('42') + abs(-1)")).toBe(43);
    expect(run("[1, 2] == [1, 2]")).toBe(true);
    expect(run("null == None")).toBe(true);
  });

  it("raises typed errors", () => {
    expect(code(() => run("xs[3]", { xs: [1] }))).toBe("INDEX_OUT_OF_RANGE");
    expect(code(() => run("missing + 1"))).toBe("UNDEFINED_VARIABLE");
    expect(code(() => run("1 + 'a'"))).toBe("TYPE_MISMATCH");
    expect(code(() => run("1 and true"))).toBe("TYPE_MISMATCH");
    expect(code(() => run("5 // 0"))).toBe("DIVISION_BY_ZERO");
    expect(code(() => run("9007199254740991 + 1"))).toBe("INTEGER_OVERFLOW");
  });

  it("short-circuits and/or so guarded indexing is safe", () => {
    expect(run("i < len(xs) and xs[i] > 0", { i: 5, xs: [1] })).toBe(false);
  });

  it("rejects code-like input instead of evaluating it", () => {
    expect(code(() => parseExpression("alert(1)"))).toBe("PARSE_ERROR");
    expect(code(() => parseExpression("x.constructor"))).toBe("PARSE_ERROR");
    expect(code(() => parseExpression("a = 1"))).toBe("PARSE_ERROR");
    expect(code(() => parseExpression("1 < x < 3"))).toBe("PARSE_ERROR");
    expect(code(() => parseExpression("(".repeat(100) + "1" + ")".repeat(100)))).toBe("PARSE_ERROR");
    expect(code(() => parseExpression(""))).toBe("PARSE_ERROR");
  });

  it("parses assignment targets", () => {
    expect(parseTarget("count").name).toBe("count");
    expect(parseTarget("grid[r][c]").indices).toHaveLength(2);
    expect(code(() => parseTarget("a + b"))).toBe("PARSE_ERROR");
    expect(code(() => parseTarget("len"))).toBe("PARSE_ERROR");
  });
});
