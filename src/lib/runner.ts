// Runs the engine in a dedicated Web Worker so long executions never block
// the UI. Falls back to the main thread if workers are unavailable.

import { execute, type ExecutionResult } from "./engine/interpreter";
import { judgeGraph, type JudgeCase, type JudgeReport } from "./engine/judge";
import type { FlowGraph, Value } from "./engine/types";

export type EngineRequest =
  | { type: "execute"; graph: FlowGraph; input: Record<string, Value>; expectedInputs: string[] }
  | { type: "judge"; graph: FlowGraph; cases: JudgeCase[]; expectedInputs: string[] };

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

// The engine enforces its own 2 s wall-clock limit per run; this is a backstop.
const HARD_TIMEOUT_MS = 15_000;

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; failure?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(e.data.id);
      if (e.data.failure) p.reject(new Error(e.data.failure));
      else p.resolve(e.data.result);
    };
    worker.onerror = () => {
      workerBroken = true;
      resetWorker(new Error("The execution worker crashed"));
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function resetWorker(reason: Error) {
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(reason);
  }
  pending.clear();
}

function runLocally(req: EngineRequest): unknown {
  return req.type === "execute"
    ? execute(req.graph, req.input, { trace: true, expectedInputs: req.expectedInputs })
    : judgeGraph(req.graph, req.cases, req.expectedInputs);
}

function send<T>(req: EngineRequest): Promise<T> {
  const w = getWorker();
  if (!w) return Promise.resolve(runLocally(req) as T);
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resetWorker(new Error("Execution did not finish in time")), HARD_TIMEOUT_MS);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    w.postMessage({ id, req });
  });
}

export const runGraph = (graph: FlowGraph, input: Record<string, Value>, expectedInputs: string[]) =>
  send<ExecutionResult>({ type: "execute", graph, input, expectedInputs });

export const judgeLocally = (graph: FlowGraph, cases: JudgeCase[], expectedInputs: string[]) =>
  send<JudgeReport>({ type: "judge", graph, cases, expectedInputs });
