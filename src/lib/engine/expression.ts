// Restricted expression language. User text is tokenized and parsed into an
// AST; nothing is ever handed to eval/new Function.

import { EngineError, LIMITS } from "./types";

export type Expr =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "null" }
  | { t: "var"; name: string }
  | { t: "list"; items: Expr[] }
  | { t: "map"; entries: [Expr, Expr][] }
  | { t: "index"; obj: Expr; index: Expr }
  | { t: "call"; fn: string; args: Expr[] }
  | { t: "unary"; op: "-" | "not"; arg: Expr }
  | { t: "binary"; op: BinaryOp; left: Expr; right: Expr };

export type BinaryOp =
  | "+" | "-" | "*" | "/" | "//" | "%"
  | "==" | "!=" | "<" | "<=" | ">" | ">="
  | "and" | "or" | "in" | "not in";

type Token =
  | { k: "num"; v: number; pos: number }
  | { k: "str"; v: string; pos: number }
  | { k: "id"; v: string; pos: number }
  | { k: "op"; v: string; pos: number }
  | { k: "eof"; pos: number };

export const KEYWORDS = new Set(["and", "or", "not", "in", "true", "false", "True", "False", "null", "None"]);

export const BUILTINS = new Set([
  "len", "length", "append", "abs", "min", "max", "str", "int",
  "lower", "upper", "slice", "array", "is_digit", "is_letter",
  "has", "get", "keys", "values", "remove", "pop", "sort",
]);

const OPERATORS = ["//", "==", "!=", "<=", ">=", "&&", "||", "+", "-", "*", "/", "%", "<", ">", "!", "(", ")", "[", "]", "{", "}", ":", ","];

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      const start = i;
      while (i < src.length && src[i] >= "0" && src[i] <= "9") i++;
      if (src[i] === "." && src[i + 1] >= "0" && src[i + 1] <= "9") {
        i++;
        while (i < src.length && src[i] >= "0" && src[i] <= "9") i++;
      }
      tokens.push({ k: "num", v: Number(src.slice(start, i)), pos: start });
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i;
      let out = "";
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\" && i + 1 < src.length) {
          const n = src[i + 1];
          out += n === "n" ? "\n" : n === "t" ? "\t" : n;
          i += 2;
        } else {
          out += src[i++];
        }
      }
      if (i >= src.length) throw new EngineError("PARSE_ERROR", `Unterminated string starting at column ${start + 1}`);
      i++;
      tokens.push({ k: "str", v: out, pos: start });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
      tokens.push({ k: "id", v: src.slice(start, i), pos: start });
      continue;
    }
    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (!op) throw new EngineError("PARSE_ERROR", `Unexpected character '${c}' at column ${i + 1}`);
    tokens.push({ k: "op", v: op, pos: i });
    i += op.length;
  }
  tokens.push({ k: "eof", pos: src.length });
  return tokens;
}

class Parser {
  private p = 0;
  private depth = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.p];
  }
  private next(): Token {
    return this.tokens[this.p++];
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return t.k === "op" && t.v === v;
  }
  private isWord(v: string): boolean {
    const t = this.peek();
    return t.k === "id" && t.v === v;
  }
  private expectOp(v: string) {
    const t = this.next();
    if (t.k !== "op" || t.v !== v) throw new EngineError("PARSE_ERROR", `Expected '${v}' at column ${t.pos + 1}`);
  }
  private enter() {
    if (++this.depth > LIMITS.maxExpressionDepth) throw new EngineError("PARSE_ERROR", "Expression is nested too deeply");
  }

  parseAll(): Expr {
    const e = this.parseOr();
    const t = this.peek();
    if (t.k !== "eof") throw new EngineError("PARSE_ERROR", `Unexpected '${"v" in t ? t.v : ""}' at column ${t.pos + 1}`);
    return e;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.isWord("or") || this.isOp("||")) {
      this.next();
      left = { t: "binary", op: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.isWord("and") || this.isOp("&&")) {
      this.next();
      left = { t: "binary", op: "and", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.isWord("not") || this.isOp("!")) {
      this.next();
      this.enter();
      const arg = this.parseNot();
      this.depth--;
      return { t: "unary", op: "not", arg };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    const left = this.parseAdditive();
    const t = this.peek();
    let op: BinaryOp | null = null;
    if (t.k === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(t.v)) op = t.v as BinaryOp;
    else if (this.isWord("in")) op = "in";
    else if (this.isWord("not") && this.tokens[this.p + 1]?.k === "id" && (this.tokens[this.p + 1] as { v: string }).v === "in") {
      this.next();
      op = "not in";
    }
    if (!op) return left;
    this.next();
    const right = this.parseAdditive();
    const after = this.peek();
    if (after.k === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(after.v)) {
      throw new EngineError("PARSE_ERROR", "Chained comparisons are not supported; combine them with 'and'");
    }
    return { t: "binary", op, left, right };
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.next() as { v: string }).v as BinaryOp;
      left = { t: "binary", op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("//") || this.isOp("%")) {
      const op = (this.next() as { v: string }).v as BinaryOp;
      left = { t: "binary", op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.isOp("-")) {
      this.next();
      this.enter();
      const arg = this.parseUnary();
      this.depth--;
      return { t: "unary", op: "-", arg };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    while (this.isOp("[")) {
      this.next();
      this.enter();
      const index = this.parseOr();
      this.depth--;
      this.expectOp("]");
      e = { t: "index", obj: e, index };
    }
    return e;
  }

  private parsePrimary(): Expr {
    const t = this.next();
    if (t.k === "num") return { t: "num", v: t.v };
    if (t.k === "str") return { t: "str", v: t.v };
    if (t.k === "id") {
      if (t.v === "true" || t.v === "True") return { t: "bool", v: true };
      if (t.v === "false" || t.v === "False") return { t: "bool", v: false };
      if (t.v === "null" || t.v === "None") return { t: "null" };
      if (KEYWORDS.has(t.v)) throw new EngineError("PARSE_ERROR", `Unexpected keyword '${t.v}' at column ${t.pos + 1}`);
      if (this.isOp("(")) {
        this.next();
        if (!BUILTINS.has(t.v)) throw new EngineError("PARSE_ERROR", `Unknown function '${t.v}'`);
        const args = this.parseList(")");
        return { t: "call", fn: t.v, args };
      }
      return { t: "var", name: t.v };
    }
    if (t.k === "op" && t.v === "(") {
      this.enter();
      const e = this.parseOr();
      this.depth--;
      this.expectOp(")");
      return e;
    }
    if (t.k === "op" && t.v === "[") {
      return { t: "list", items: this.parseList("]") };
    }
    if (t.k === "op" && t.v === "{") {
      return { t: "map", entries: this.parseEntries() };
    }
    if (t.k === "eof") throw new EngineError("PARSE_ERROR", "Expression ended unexpectedly");
    throw new EngineError("PARSE_ERROR", `Unexpected '${t.v}' at column ${t.pos + 1}`);
  }

  private parseEntries(): [Expr, Expr][] {
    const entries: [Expr, Expr][] = [];
    this.enter();
    if (this.isOp("}")) {
      this.next();
      this.depth--;
      return entries;
    }
    for (;;) {
      const key = this.parseOr();
      this.expectOp(":");
      entries.push([key, this.parseOr()]);
      if (this.isOp(",")) {
        this.next();
        continue;
      }
      this.expectOp("}");
      break;
    }
    this.depth--;
    return entries;
  }

  private parseList(close: string): Expr[] {
    const items: Expr[] = [];
    this.enter();
    if (this.isOp(close)) {
      this.next();
      this.depth--;
      return items;
    }
    for (;;) {
      items.push(this.parseOr());
      if (this.isOp(",")) {
        this.next();
        continue;
      }
      this.expectOp(close);
      break;
    }
    this.depth--;
    return items;
  }
}

export function parseExpression(src: string): Expr {
  if (src.length > LIMITS.maxExpressionLength) {
    throw new EngineError("PARSE_ERROR", `Expression is longer than ${LIMITS.maxExpressionLength} characters`);
  }
  if (!src.trim()) throw new EngineError("PARSE_ERROR", "Expression is empty");
  return new Parser(tokenize(src)).parseAll();
}

/** Assignment target: `name` or `name[expr]` (possibly nested, e.g. grid[r][c]). */
export interface AssignTarget {
  name: string;
  indices: Expr[];
}

export function parseTarget(src: string): AssignTarget {
  const e = parseExpression(src);
  const indices: Expr[] = [];
  let cur = e;
  while (cur.t === "index") {
    indices.unshift(cur.index);
    cur = cur.obj;
  }
  if (cur.t !== "var") {
    throw new EngineError("PARSE_ERROR", "Target must be a variable name or an indexed element such as result[i]");
  }
  if (BUILTINS.has(cur.name)) throw new EngineError("PARSE_ERROR", `'${cur.name}' is a built-in function name`);
  return { name: cur.name, indices };
}

export function collectVariables(e: Expr, out: Set<string> = new Set()): Set<string> {
  switch (e.t) {
    case "var":
      out.add(e.name);
      break;
    case "list":
      e.items.forEach((x) => collectVariables(x, out));
      break;
    case "map":
      e.entries.forEach(([k, v]) => {
        collectVariables(k, out);
        collectVariables(v, out);
      });
      break;
    case "index":
      collectVariables(e.obj, out);
      collectVariables(e.index, out);
      break;
    case "call":
      e.args.forEach((x) => collectVariables(x, out));
      break;
    case "unary":
      collectVariables(e.arg, out);
      break;
    case "binary":
      collectVariables(e.left, out);
      collectVariables(e.right, out);
      break;
  }
  return out;
}
