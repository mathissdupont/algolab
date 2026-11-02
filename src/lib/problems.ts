import bank from "../../content/problems/problem_bank_public.json";
import type { Value } from "./engine/types";

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface JsonSchema {
  type?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
}

export interface SampleCase {
  case_id: string;
  input: Record<string, Value>;
  output: Value;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  category: string;
  required_engine_tier: string;
  required_features: string[];
  statement: string;
  input_schema: JsonSchema;
  output_schema: JsonSchema;
  constraints: string[];
  sample_cases: SampleCase[];
  test_count: number;
  curriculum_hint: string;
  suggested_time_complexity: string;
}

export interface ProblemSummary {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  category: string;
  statement: string;
  supported: boolean;
  missingFeatures: string[];
}

/**
 * Capabilities implemented by the current engine. A problem is offered only
 * when its tier and every required feature are covered (see MVP_PROBLEMS.md).
 */
export const ENGINE_TIERS = ["foundation"];
export const ENGINE_FEATURES = ["variables", "comparisons", "loops", "arrays", "strings", "two-pointers", "binary-search"];

export const problems: Problem[] = (bank as unknown as { problems: Problem[] }).problems;

export function missingFeatures(p: Problem): string[] {
  const missing = p.required_features.filter((f) => !ENGINE_FEATURES.includes(f));
  if (!ENGINE_TIERS.includes(p.required_engine_tier)) missing.unshift(`${p.required_engine_tier} engine tier`);
  return missing;
}

export function isSupported(p: Problem): boolean {
  return missingFeatures(p).length === 0;
}

export function getProblem(slug: string): Problem | undefined {
  return problems.find((p) => p.slug === slug);
}

export function inputNames(p: Problem): string[] {
  return p.input_schema.required ?? Object.keys(p.input_schema.properties ?? {});
}

export function schemaLabel(s: JsonSchema | undefined): string {
  if (!s) return "any";
  if (s.anyOf) return s.anyOf.map(schemaLabel).join(" | ");
  if (s.type === "array") return `${schemaLabel(s.items)}[]`;
  if (s.type === "object") return "object";
  return s.type ?? "any";
}

export function summaries(): ProblemSummary[] {
  return problems.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    category: p.category,
    statement: p.statement,
    supported: isSupported(p),
    missingFeatures: missingFeatures(p),
  }));
}
