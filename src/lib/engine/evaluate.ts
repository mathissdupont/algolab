import type { Expr } from "./expression";
import { EngineError, LIMITS, type Dict, type Value } from "./types";

export type Env = Map<string, Value>;

export function isDict(v: Value): v is Dict {
  return typeof v === "object" && v !== null && !Array.isArray(v) && v.kind === "dict";
}

export function makeDict(): Dict {
  return { kind: "dict", entries: new Map() };
}

/** Canonical key: maps accept numbers, text and booleans as keys. */
export function dictKey(k: Value): string {
  if (typeof k === "number" || typeof k === "string" || typeof k === "boolean") return `${typeof k}:${k}`;
  return mismatch(`Map keys must be numbers, text or true/false, got ${typeName(k)}`);
}

export function dictGet(m: Dict, k: Value): Value {
  const hit = m.entries.get(dictKey(k));
  if (!hit) throw new EngineError("KEY_NOT_FOUND", `Key ${formatValue(k)} is not in the map; check it with has() first or use get(map, key, default)`);
  return hit[1];
}

export function dictSet(m: Dict, k: Value, v: Value) {
  const key = dictKey(k);
  if (!m.entries.has(key) && m.entries.size >= LIMITS.maxCollectionSize) {
    throw new EngineError("COLLECTION_LIMIT", `Maps are limited to ${LIMITS.maxCollectionSize} keys`);
  }
  m.entries.set(key, [k, v]);
}

export function typeName(v: Value): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (isDict(v)) return "map";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

export function cloneValue(v: Value): Value {
  if (Array.isArray(v)) return v.map(cloneValue);
  if (isDict(v)) {
    const out = makeDict();
    for (const [key, [k, val]] of v.entries) out.entries.set(key, [k, cloneValue(val)]);
    return out;
  }
  return v;
}

export function valuesEqual(a: Value, b: Value): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!valuesEqual(a[i], b[i])) return false;
    return true;
  }
  if (isDict(a) || isDict(b)) {
    if (!isDict(a) || !isDict(b) || a.entries.size !== b.entries.size) return false;
    for (const [key, [, va]] of a.entries) {
      const hit = b.entries.get(key);
      if (!hit || !valuesEqual(va, hit[1])) return false;
    }
    return true;
  }
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isInteger(a) && Number.isInteger(b)) return a === b;
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  }
  return a === b;
}

export function formatValue(v: Value): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(formatValue).join(", ")}]`;
  if (isDict(v)) return `{${[...v.entries.values()].map(([k, val]) => `${formatValue(k)}: ${formatValue(val)}`).join(", ")}}`;
  return String(v);
}

/** Total order used by sort(): numbers, text, or arrays compared item by item. */
function orderOf(a: Value, b: Value): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const c = orderOf(a[i], b[i]);
      if (c !== 0) return c;
    }
    return a.length - b.length;
  }
  return mismatch(`sort() can only order numbers, text or arrays of them, got ${typeName(a)} and ${typeName(b)}`);
}

function mismatch(msg: string): never {
  throw new EngineError("TYPE_MISMATCH", msg);
}

function isInt(v: Value): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

function num(v: Value, what: string): number {
  if (typeof v !== "number") mismatch(`${what} must be a number, got ${typeName(v)}`);
  return v;
}

function bool(v: Value, what: string): boolean {
  if (typeof v !== "boolean") mismatch(`${what} must be true or false, got ${typeName(v)}`);
  return v;
}

function checkInt(result: number, a: number, b: number): number {
  if (Number.isInteger(a) && Number.isInteger(b) && !Number.isSafeInteger(result)) {
    throw new EngineError("INTEGER_OVERFLOW", "Integer result is outside the supported range (±9007199254740991)");
  }
  return result;
}

function needDict(v: Value, fn: string): Dict {
  if (!isDict(v)) mismatch(`${fn}() needs a map, got ${typeName(v)}`);
  return v;
}

function checkSize(v: Value): Value {
  if (Array.isArray(v) && v.length > LIMITS.maxCollectionSize) {
    throw new EngineError("COLLECTION_LIMIT", `Arrays are limited to ${LIMITS.maxCollectionSize} elements`);
  }
  if (typeof v === "string" && v.length > LIMITS.maxStringLength) {
    throw new EngineError("COLLECTION_LIMIT", `Strings are limited to ${LIMITS.maxStringLength} characters`);
  }
  return v;
}

/** Python-style index resolution (negative indexes count from the end). */
export function resolveIndex(container: Value, idx: Value): number {
  if (!Array.isArray(container) && typeof container !== "string") {
    mismatch(`Only arrays, text and maps can be indexed, got ${typeName(container)}`);
  }
  if (!isInt(idx)) mismatch(`Index must be an integer, got ${typeName(idx)}`);
  const n = container.length;
  const i = idx < 0 ? idx + n : idx;
  if (i < 0 || i >= n) {
    throw new EngineError("INDEX_OUT_OF_RANGE", `Index ${idx} is out of range for length ${n}`);
  }
  return i;
}

function compare(a: Value, b: Value, op: string): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b;
  }
  if (typeof a === "string" && typeof b === "string") {
    return op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b;
  }
  return mismatch(`Cannot compare ${typeName(a)} ${op} ${typeName(b)}`);
}

function contains(container: Value, item: Value): boolean {
  if (isDict(container)) return container.entries.has(dictKey(item));
  if (typeof container === "string") {
    if (typeof item !== "string") mismatch(`'in' on a string needs a string on the left, got ${typeName(item)}`);
    return container.includes(item);
  }
  if (Array.isArray(container)) return container.some((x) => valuesEqual(x, item));
  return mismatch(`'in' needs an array or string on the right, got ${typeName(container)}`);
}

function pyStr(v: Value): string {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return formatValue(v);
}

function sliceBound(v: Value, n: number, what: string): number {
  if (!isInt(v)) mismatch(`slice ${what} must be an integer`);
  const i = v < 0 ? v + n : v;
  return Math.max(0, Math.min(n, i));
}

function arity(fn: string, args: Value[], min: number, max = min) {
  if (args.length < min || args.length > max) {
    const expected = min === max ? `${min}` : `${min}-${max}`;
    mismatch(`${fn}() expects ${expected} argument(s), got ${args.length}`);
  }
}

function callBuiltin(fn: string, args: Value[]): Value {
  switch (fn) {
    case "len":
    case "length": {
      arity(fn, args, 1);
      const x = args[0];
      if (isDict(x)) return x.entries.size;
      if (typeof x !== "string" && !Array.isArray(x)) mismatch(`${fn}() needs an array, text or map, got ${typeName(x)}`);
      return x.length;
    }
    case "append": {
      arity(fn, args, 2);
      if (!Array.isArray(args[0])) mismatch(`append() needs an array first, got ${typeName(args[0])}`);
      return checkSize([...args[0], cloneValue(args[1])]);
    }
    case "abs":
      arity(fn, args, 1);
      return Math.abs(num(args[0], "abs() argument"));
    case "min":
    case "max": {
      if (args.length === 0) mismatch(`${fn}() needs at least one argument`);
      const items = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      if (items.length === 0) mismatch(`${fn}() of an empty array`);
      let best = items[0];
      for (const x of items.slice(1)) {
        const better = fn === "min" ? compare(x, best, "<") : compare(x, best, ">");
        if (better) best = x;
      }
      return best;
    }
    case "str":
      arity(fn, args, 1);
      return pyStr(args[0]);
    case "int": {
      arity(fn, args, 1);
      const x = args[0];
      if (typeof x === "number") return Math.trunc(x);
      if (typeof x === "string" && /^\s*[-+]?\d+\s*$/.test(x)) return checkInt(parseInt(x, 10), 0, 0);
      if (typeof x === "boolean") return x ? 1 : 0;
      return mismatch(`int() cannot convert ${formatValue(x)}`);
    }
    case "lower":
    case "upper": {
      arity(fn, args, 1);
      if (typeof args[0] !== "string") mismatch(`${fn}() needs a string, got ${typeName(args[0])}`);
      return fn === "lower" ? args[0].toLowerCase() : args[0].toUpperCase();
    }
    case "slice": {
      arity(fn, args, 2, 3);
      const x = args[0];
      if (typeof x !== "string" && !Array.isArray(x)) mismatch(`slice() needs an array or string, got ${typeName(x)}`);
      const start = sliceBound(args[1], x.length, "start");
      const end = args.length === 3 ? sliceBound(args[2], x.length, "end") : x.length;
      return typeof x === "string" ? x.slice(start, end) : x.slice(start, end).map(cloneValue);
    }
    case "array": {
      arity(fn, args, 1, 2);
      const n = args[0];
      if (!isInt(n) || n < 0) mismatch("array() size must be a non-negative integer");
      if (n > LIMITS.maxCollectionSize) throw new EngineError("COLLECTION_LIMIT", `Arrays are limited to ${LIMITS.maxCollectionSize} elements`);
      const fill = args.length === 2 ? args[1] : 0;
      return Array.from({ length: n }, () => cloneValue(fill));
    }
    case "has":
      arity(fn, args, 2);
      return needDict(args[0], fn).entries.has(dictKey(args[1]));
    case "get": {
      arity(fn, args, 2, 3);
      const hit = needDict(args[0], fn).entries.get(dictKey(args[1]));
      return hit ? hit[1] : args.length === 3 ? args[2] : null;
    }
    case "keys":
      arity(fn, args, 1);
      return [...needDict(args[0], fn).entries.values()].map(([k]) => k);
    case "values":
      arity(fn, args, 1);
      return [...needDict(args[0], fn).entries.values()].map(([, v]) => cloneValue(v));
    case "remove": {
      arity(fn, args, 2);
      const copy = cloneValue(needDict(args[0], fn)) as Dict;
      copy.entries.delete(dictKey(args[1]));
      return copy;
    }
    case "pop": {
      arity(fn, args, 1);
      if (!Array.isArray(args[0])) mismatch(`pop() needs an array, got ${typeName(args[0])}`);
      if (args[0].length === 0) throw new EngineError("INDEX_OUT_OF_RANGE", "pop() of an empty array");
      return args[0].slice(0, -1).map(cloneValue);
    }
    case "sort": {
      arity(fn, args, 1);
      if (!Array.isArray(args[0])) mismatch(`sort() needs an array, got ${typeName(args[0])}`);
      return args[0].map(cloneValue).sort(orderOf);
    }
    case "is_digit":
    case "is_letter": {
      arity(fn, args, 1);
      const s = args[0];
      if (typeof s !== "string") mismatch(`${fn}() needs a string, got ${typeName(s)}`);
      const re = fn === "is_digit" ? /^[0-9]+$/ : /^[A-Za-z]+$/;
      return re.test(s);
    }
  }
  throw new EngineError("UNKNOWN_FUNCTION", `Unknown function '${fn}'`);
}

export function evaluate(e: Expr, env: Env): Value {
  switch (e.t) {
    case "num":
      return e.v;
    case "str":
      return e.v;
    case "bool":
      return e.v;
    case "null":
      return null;
    case "var": {
      if (!env.has(e.name)) throw new EngineError("UNDEFINED_VARIABLE", `Variable '${e.name}' has not been assigned yet`);
      return env.get(e.name)!;
    }
    case "list":
      return checkSize(e.items.map((x) => cloneValue(evaluate(x, env))));
    case "map": {
      const m = makeDict();
      for (const [k, v] of e.entries) dictSet(m, evaluate(k, env), cloneValue(evaluate(v, env)));
      return m;
    }
    case "index": {
      const obj = evaluate(e.obj, env);
      const idx = evaluate(e.index, env);
      if (isDict(obj)) return dictGet(obj, idx);
      const i = resolveIndex(obj, idx);
      return (obj as Value[] | string)[i];
    }
    case "call":
      return callBuiltin(e.fn, e.args.map((a) => evaluate(a, env)));
    case "unary": {
      const v = evaluate(e.arg, env);
      if (e.op === "-") return -num(v, "Operand of unary '-'");
      return !bool(v, "Operand of 'not'");
    }
    case "binary":
      return evalBinary(e.op, e.left, e.right, env);
  }
}

function evalBinary(op: string, le: Expr, re: Expr, env: Env): Value {
  if (op === "and") {
    if (!bool(evaluate(le, env), "Left side of 'and'")) return false;
    return bool(evaluate(re, env), "Right side of 'and'");
  }
  if (op === "or") {
    if (bool(evaluate(le, env), "Left side of 'or'")) return true;
    return bool(evaluate(re, env), "Right side of 'or'");
  }
  const a = evaluate(le, env);
  const b = evaluate(re, env);
  switch (op) {
    case "==":
      return valuesEqual(a, b);
    case "!=":
      return !valuesEqual(a, b);
    case "<":
    case "<=":
    case ">":
    case ">=":
      return compare(a, b, op);
    case "in":
      return contains(b, a);
    case "not in":
      return !contains(b, a);
    case "+": {
      if (typeof a === "number" && typeof b === "number") return checkInt(a + b, a, b);
      if (typeof a === "string" && typeof b === "string") return checkSize(a + b);
      if (Array.isArray(a) && Array.isArray(b)) return checkSize([...a, ...b].map(cloneValue));
      return mismatch(`Cannot add ${typeName(a)} and ${typeName(b)}; use str() to convert numbers to text`);
    }
    case "-":
      return checkInt(num(a, "Left side of '-'") - num(b, "Right side of '-'"), a as number, b as number);
    case "*":
      return checkInt(num(a, "Left side of '*'") * num(b, "Right side of '*'"), a as number, b as number);
    case "/": {
      const x = num(a, "Left side of '/'");
      const y = num(b, "Right side of '/'");
      if (y === 0) throw new EngineError("DIVISION_BY_ZERO", "Division by zero");
      return x / y;
    }
    case "//": {
      const x = num(a, "Left side of '//'");
      const y = num(b, "Right side of '//'");
      if (y === 0) throw new EngineError("DIVISION_BY_ZERO", "Integer division by zero");
      return Math.floor(x / y);
    }
    case "%": {
      const x = num(a, "Left side of '%'");
      const y = num(b, "Right side of '%'");
      if (y === 0) throw new EngineError("DIVISION_BY_ZERO", "Modulo by zero");
      return ((x % y) + y) % y;
    }
  }
  throw new EngineError("PARSE_ERROR", `Unsupported operator '${op}'`);
}
