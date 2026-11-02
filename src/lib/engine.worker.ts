/// <reference lib="webworker" />
import { execute } from "./engine/interpreter";
import { judgeGraph } from "./engine/judge";
import type { EngineRequest } from "./runner";

self.onmessage = (e: MessageEvent<{ id: number; req: EngineRequest }>) => {
  const { id, req } = e.data;
  try {
    const result =
      req.type === "execute"
        ? execute(req.graph, req.input, { trace: true, expectedInputs: req.expectedInputs })
        : judgeGraph(req.graph, req.cases, req.expectedInputs);
    postMessage({ id, result });
  } catch (err) {
    postMessage({ id, failure: (err as Error).message });
  }
};
