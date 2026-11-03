"use client";

// Page pattern: Split pane — problem | flowchart canvas | inspector/debug/tests.
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { CircleCheck, Play, Redo2, SkipForward, StepBack, StepForward, TriangleAlert, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProblemPanel } from "@/components/ProblemPanel";
import { IconButton, Segmented, button, useModKey } from "@/components/ui";
import { parseTarget } from "@/lib/engine/expression";
import type { JudgeCase } from "@/lib/engine/judge";
import { NODE_PORTS, type NodeKind, type Value } from "@/lib/engine/types";
import { validateGraph } from "@/lib/engine/validate";
import {
  clearDraft,
  loadDraft,
  makeEdge,
  newNodeData,
  newNodeId,
  saveDraft,
  starterDraft,
  toIR,
  type Draft,
  type FlowNodeData,
  type RFEdge,
  type RFNode,
} from "@/lib/flow/convert";
import { JUDGE_URL, submitToJudge } from "@/lib/judgeClient";
import { inputNames, type Problem } from "@/lib/problems";
import { judgeLocally, runGraph } from "@/lib/runner";
import { DebugPanel, type RunState } from "./DebugPanel";
import { FlowNodeComponent, KIND_META } from "./FlowNode";
import { Inspector } from "./Inspector";
import { TestsPanel, type SubmissionState } from "./TestsPanel";

const nodeTypes = { flow: FlowNodeComponent };
const PALETTE: NodeKind[] = ["assign", "decision", "while", "return"];
const FIXED: NodeKind[] = ["start", "input"];
const HISTORY_LIMIT = 100;

type RightTab = "inspect" | "debug" | "tests";
type MobileTab = "problem" | "flow" | "panel";

function withFlags(nodes: RFNode[]): RFNode[] {
  return nodes.map((n) => ({ ...n, deletable: !FIXED.includes(n.data.kind) }));
}

/** Animation length that collapses to 0 when the user asked for reduced motion. */
function motion(ms: number): number {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

function nodeLabel(n: RFNode): string {
  const d = n.data;
  const what =
    d.label?.trim() ||
    (d.kind === "assign" ? `${d.target || "?"} ← ${d.expression || "?"}` : d.kind === "decision" || d.kind === "while" ? d.condition || "?" : d.kind === "return" ? d.expression || "?" : "");
  return what ? `${KIND_META[d.kind].label}: ${what}` : KIND_META[d.kind].label;
}

function Editor({ problem }: { problem: Problem }) {
  const rf = useReactFlow<RFNode, RFEdge>();
  const mod = useModKey();
  const expectedInputs = useMemo(() => inputNames(problem), [problem]);

  const [nodes, setNodes] = useState<RFNode[]>(() => withFlags(starterDraft(problem).nodes));
  const [edges, setEdges] = useState<RFEdge[]>(() => starterDraft(problem).edges);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("inspect");
  const [mobileTab, setMobileTab] = useState<MobileTab>("flow");
  const [showIssues, setShowIssues] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // ── History (undo/redo) ─────────────────────────────────────────────
  const past = useRef<Draft[]>([]);
  const future = useRef<Draft[]>([]);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const latest = useRef<Draft>({ nodes, edges });
  latest.current = { nodes, edges };

  const commit = useCallback(() => {
    past.current.push(latest.current);
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
    rerender();
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(latest.current);
    setNodes(prev.nodes);
    setEdges(prev.edges);
    rerender();
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(latest.current);
    setNodes(next.nodes);
    setEdges(next.edges);
    rerender();
  }, []);

  // ── Draft persistence (this browser only) ───────────────────────────
  useEffect(() => {
    const d = loadDraft(problem.slug);
    if (d) {
      setNodes(withFlags(d.nodes));
      setEdges(d.edges);
    }
    setLoaded(true);
    requestAnimationFrame(() => rf.fitView({ padding: 0.25, maxZoom: 1.1 }));
  }, [problem.slug, rf]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => saveDraft(problem.slug, { nodes, edges }), 400);
    return () => clearTimeout(t);
  }, [nodes, edges, loaded, problem.slug]);

  // Flush a pending save when the page is closed or reloaded.
  useEffect(() => {
    if (!loaded) return;
    const flush = () => saveDraft(problem.slug, latest.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [loaded, problem.slug]);

  // ── Program model + validation ──────────────────────────────────────
  const ir = useMemo(() => toIR(nodes, edges), [nodes, edges]);
  const irKey = useMemo(() => JSON.stringify(ir), [ir]);
  const validation = useMemo(() => validateGraph(ir, expectedInputs), [irKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const errorNodes = useMemo(() => new Set(validation.errors.map((e) => e.nodeId).filter(Boolean)), [validation]);

  const knownVars = useMemo(() => {
    const vars = new Set(expectedInputs);
    for (const n of nodes) {
      if (n.data.kind === "assign" && n.data.target?.trim()) {
        try {
          vars.add(parseTarget(n.data.target.trim()).name);
        } catch {}
      }
    }
    return [...vars];
  }, [nodes, expectedInputs]);

  // ── Execution state ─────────────────────────────────────────────────
  const [caseChoice, setCaseChoice] = useState(0); // sample index, or -1 = custom
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(expectedInputs.map((k) => [k, JSON.stringify(problem.sample_cases[0]?.input[k] ?? null)])),
  );
  const [customError, setCustomError] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState<false | "run" | "submit">(false);
  const [submission, setSubmission] = useState<SubmissionState | null>(null);

  // Any semantic change makes the current trace stale.
  useEffect(() => {
    setRun(null);
  }, [irKey]);

  const trace = run?.result.trace ?? [];
  const activeId = run ? trace[cursor]?.nodeId : undefined;
  const fromId = run && cursor > 0 ? trace[cursor - 1]?.nodeId : undefined;

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => {
        const active = n.id === activeId;
        const hasError = showIssues && errorNodes.has(n.id);
        return active || hasError ? { ...n, data: { ...n.data, active, hasError } } : n;
      }),
    [nodes, activeId, showIssues, errorNodes],
  );
  // The edge just taken is highlighted with colour and weight, not motion.
  const displayEdges = useMemo(() => {
    if (!fromId || !activeId) return edges;
    const entry = trace[cursor - 1];
    const port = entry?.note?.split("→ ")[1] ?? "next";
    return edges.map((e) => (e.source === fromId && e.target === activeId && (e.sourceHandle ?? "next") === port ? { ...e, className: "is-taken" } : e));
  }, [edges, fromId, activeId, trace, cursor]);

  // ── Graph editing ───────────────────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange<RFNode>[]) => setNodes((ns) => applyNodeChanges(changes, ns)), []);
  const onEdgesChange = useCallback((changes: EdgeChange<RFEdge>[]) => setEdges((es) => applyEdgeChanges(changes, es)), []);

  const connectPort = useCallback(
    (source: string, port: string, target: string | null, targetHandle?: string | null) => {
      commit();
      setEdges((es) => {
        const kept = es.filter((e) => !(e.source === source && (e.sourceHandle ?? "next") === port));
        return target ? kept.concat(makeEdge(source, port, target, targetHandle)) : kept;
      });
    },
    [commit],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.sourceHandle || c.source === c.target) return;
      connectPort(c.source, c.sourceHandle, c.target, c.targetHandle);
    },
    [connectPort],
  );

  const updateNode = useCallback((id: string, patch: Partial<FlowNodeData>) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, []);

  const deleteNode = useCallback(
    (id: string) => {
      const n = nodes.find((x) => x.id === id);
      if (!n || FIXED.includes(n.data.kind)) return;
      commit();
      setNodes((ns) => ns.filter((x) => x.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedId(null);
    },
    [nodes, commit],
  );

  const addNode = useCallback(
    (kind: NodeKind, at?: { x: number; y: number }) => {
      commit();
      const id = newNodeId(kind);
      const selected = nodes.find((n) => n.id === selectedId);
      const freePort = selected
        ? NODE_PORTS[selected.data.kind].find((p) => !edges.some((e) => e.source === selected.id && (e.sourceHandle ?? "next") === p))
        : undefined;
      let position = at;
      if (!position && selected && freePort) {
        const sideways = freePort === "false" || freePort === "exit";
        position = { x: selected.position.x + (sideways ? 260 : 0), y: selected.position.y + (sideways ? 40 : 120) };
      }
      if (!position) {
        const el = document.querySelector(".react-flow")?.getBoundingClientRect();
        const center = el ? { x: el.left + el.width / 2, y: el.top + el.height / 2 } : { x: 400, y: 300 };
        position = rf.screenToFlowPosition(center);
        position = { x: position.x - 80 + (nodes.length % 5) * 12, y: position.y - 24 + (nodes.length % 5) * 12 };
      }
      // Nudge the new node until it doesn't sit on top of an existing one.
      const overlaps = (p: { x: number; y: number }) =>
        nodes.some((n) => Math.abs(n.position.x - p.x) < (n.measured?.width ?? 180) && Math.abs(n.position.y - p.y) < (n.measured?.height ?? 60) + 16);
      for (let tries = 0; tries < 40 && overlaps(position); tries++) {
        position = freePort === "false" || freePort === "exit" ? { x: position.x + 64, y: position.y } : { x: position.x, y: position.y + 80 };
      }
      const node: RFNode = { id, type: "flow", position, data: newNodeData(kind), selected: true };
      setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)).concat(node));
      if (!at && selected && freePort) setEdges((es) => es.concat(makeEdge(selected.id, freePort, id)));
      const rect = document.querySelector(".react-flow")?.getBoundingClientRect();
      const screen = rf.flowToScreenPosition(position);
      if (rect && (screen.x < rect.left || screen.x + 180 > rect.right || screen.y < rect.top || screen.y + 70 > rect.bottom)) {
        rf.setCenter(position.x + 90, position.y + 30, { zoom: rf.getZoom(), duration: motion(200) });
      }
      setSelectedId(id);
      setRightTab("inspect");
    },
    [commit, nodes, edges, selectedId, rf],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const kind = e.dataTransfer.getData("application/algolab-node") as NodeKind;
      if (!kind) return;
      e.preventDefault();
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(kind, { x: p.x - 80, y: p.y - 24 });
    },
    [rf, addNode],
  );

  const focusNode = useCallback(
    (id: string) => {
      const n = nodes.find((x) => x.id === id);
      if (!n) return;
      setNodes((ns) => ns.map((x) => ({ ...x, selected: x.id === id })));
      setSelectedId(id);
      setMobileTab("flow");
      rf.setCenter(n.position.x + 90, n.position.y + 30, { zoom: Math.max(rf.getZoom(), 0.9), duration: motion(300) });
    },
    [nodes, rf],
  );

  const clearChart = () => {
    commit();
    const s = starterDraft(problem);
    setNodes(withFlags(s.nodes));
    setEdges(s.edges);
    setSelectedId(null);
    clearDraft(problem.slug);
    requestAnimationFrame(() => rf.fitView({ padding: 0.25, maxZoom: 1.1 }));
  };

  // ── Running ─────────────────────────────────────────────────────────
  const requireValid = () => {
    setShowIssues(true);
    if (!validation.ok) {
      setIssuesOpen(true);
      setMobileTab("flow");
      return false;
    }
    return true;
  };

  const resolveInput = (): { input: Record<string, Value>; label: string; expected?: Value; hasExpected: boolean } | null => {
    if (caseChoice >= 0) {
      const c = problem.sample_cases[caseChoice];
      return { input: c.input, label: `Example ${caseChoice + 1}`, expected: c.output, hasExpected: true };
    }
    const input: Record<string, Value> = {};
    for (const name of expectedInputs) {
      try {
        input[name] = JSON.parse(custom[name]);
      } catch {
        const sample = JSON.stringify(problem.sample_cases[0]?.input[name] ?? null);
        setCustomError(`Enter ${name} as JSON, for example ${sample}.`);
        setRightTab("tests");
        setMobileTab("panel");
        return null;
      }
    }
    setCustomError(null);
    return { input, label: "Custom input", hasExpected: false };
  };

  const breakpointIds = useMemo(() => new Set(nodes.filter((n) => n.data.breakpoint).map((n) => n.id)), [nodes]);
  const nextBreakpoint = (t: typeof trace, from: number) => {
    for (let i = from; i < t.length; i++) if (breakpointIds.has(t[i].nodeId)) return i;
    return t.length - 1;
  };

  const startRun = async (mode: "run" | "step") => {
    if (busy || !requireValid()) return;
    const resolved = resolveInput();
    if (!resolved) return;
    setBusy("run");
    try {
      const result = await runGraph(ir, resolved.input, expectedInputs);
      setRun({ result, ...resolved });
      setCursor(mode === "step" ? 0 : result.status === "error" ? Math.max(0, result.trace.length - 1) : nextBreakpoint(result.trace, 1));
      setRightTab("debug");
    } catch (e) {
      setRun({
        result: { status: "error", error: { code: "TIME_LIMIT_EXCEEDED", message: (e as Error).message }, steps: 0, trace: [], traceTruncated: false },
        ...resolved,
      });
      setRightTab("debug");
    } finally {
      setBusy(false);
    }
  };

  const stepForward = () => (run ? setCursor((c) => Math.min(c + 1, trace.length - 1)) : startRun("step"));
  const stepBack = () => setCursor((c) => Math.max(0, c - 1));
  const continueRun = () => (run ? setCursor(nextBreakpoint(trace, cursor + 1)) : startRun("run"));

  const checkExamples = async () => {
    if (busy || !requireValid()) return;
    setBusy("submit");
    setRightTab("tests");
    const cases: JudgeCase[] = problem.sample_cases.map((c) => ({ ...c, visibility: "public" }));
    try {
      setSubmission({ mode: "local", report: await judgeLocally(ir, cases, expectedInputs) });
    } catch (e) {
      setSubmission({ mode: "local", error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!JUDGE_URL) return checkExamples();
    if (busy || !requireValid()) return;
    setBusy("submit");
    setRightTab("tests");
    setMobileTab("panel");
    try {
      const res = await submitToJudge(problem.slug, ir);
      setSubmission({ mode: "judge", report: res.report, submissionId: res.submission_id });
    } catch (e) {
      setSubmission({ mode: "judge", error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  const handlers = useRef({ undo, redo, startRun, stepForward });
  handlers.current = { undo, redo, startRun, stepForward };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const modKey = e.ctrlKey || e.metaKey;
      if (modKey && e.key === "Enter") {
        e.preventDefault();
        handlers.current.startRun("run");
      } else if (e.key === "F10") {
        e.preventDefault();
        handlers.current.stepForward();
      } else if (!typing && modKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) handlers.current.redo();
        else handlers.current.undo();
      } else if (!typing && modKey && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handlers.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = nodes.find((n) => n.id === selectedId);
  const issueCount = validation.errors.length;
  const atEnd = !!run && cursor >= trace.length - 1;
  const pane = (tab: MobileTab) => `${mobileTab === tab ? "flex" : "hidden"} lg:flex min-h-0 flex-col`;

  const portChoices = selected
    ? NODE_PORTS[selected.data.kind].map((port) => ({
        port,
        target: edges.find((e) => e.source === selected.id && (e.sourceHandle ?? "next") === port)?.target ?? null,
      }))
    : [];
  const portTargets = selected
    ? nodes.filter((n) => n.id !== selected.id && n.data.kind !== "start").map((n) => ({ id: n.id, label: nodeLabel(n) }))
    : [];

  return (
    <div className="flex h-[calc(100dvh-3.5rem-1px)] flex-col">
      {/* Narrow: one pane at a time */}
      <div className="border-b border-separator bg-bg p-2 lg:hidden">
        <Segmented
          label="Show"
          value={mobileTab}
          onChange={setMobileTab}
          className="flex w-full"
          options={[
            { value: "problem", label: "Problem" },
            { value: "flow", label: "Flowchart" },
            { value: "panel", label: "Debug & tests" },
          ]}
        />
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(300px,26%)_1fr_minmax(320px,26%)]">
        {/* Problem */}
        <aside aria-label="Problem" className={`${pane("problem")} scroll-thin overflow-y-auto border-separator bg-bg lg:border-r`}>
          <ProblemPanel problem={problem} />
        </aside>

        {/* Canvas */}
        <section aria-label="Flowchart" className={`${pane("flow")} relative`}>
          <div role="toolbar" aria-label="Run controls" className="flex flex-wrap items-center gap-1 border-b border-separator bg-bg px-2 py-1.5">
            <label htmlFor="run-input" className="px-1 text-sm text-label-2">
              Input
            </label>
            <select
              id="run-input"
              value={caseChoice}
              onChange={(e) => setCaseChoice(Number(e.target.value))}
              className="h-11 rounded-lg bg-fill px-3 text-sm text-label"
            >
              {problem.sample_cases.map((_, i) => (
                <option key={i} value={i}>
                  Example {i + 1}
                </option>
              ))}
              <option value={-1}>Custom input</option>
            </select>
            <button type="button" onClick={() => startRun("run")} disabled={!!busy} className={`${button.primary} px-4 text-sm`}>
              <Play size={16} aria-hidden fill="currentColor" /> Run
            </button>
            <IconButton label="Step back" onClick={stepBack} disabled={!run || cursor === 0}>
              <StepBack size={20} aria-hidden />
            </IconButton>
            <IconButton label="Step forward" shortcut="F10" onClick={stepForward} disabled={!!busy || atEnd}>
              <StepForward size={20} aria-hidden />
            </IconButton>
            <IconButton label="Run to breakpoint" onClick={continueRun} disabled={!!busy || atEnd}>
              <SkipForward size={20} aria-hidden />
            </IconButton>
            <IconButton label="Clear run" onClick={() => setRun(null)} disabled={!run}>
              <X size={20} aria-hidden />
            </IconButton>
            <button type="button" onClick={submit} disabled={!!busy} className={`${button.tinted} ml-auto text-sm`}>
              {busy === "submit" ? "Judging…" : JUDGE_URL ? "Judge solution" : "Check examples"}
            </button>
          </div>

          <div className="relative min-h-0 flex-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <ReactFlow<RFNode, RFEdge>
              nodes={displayNodes}
              edges={displayEdges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDragStart={commit}
              onBeforeDelete={async () => {
                commit();
                return true;
              }}
              onSelectionChange={({ nodes: sel }) => {
                const id = sel.length === 1 ? sel[0].id : null;
                if (id === selectedId) return; // also fires when node objects are refreshed
                setSelectedId(id);
                // Keep the debugger open while stepping; otherwise show the selected node.
                if (id) setRightTab((t) => (t === "debug" && run ? t : "inspect"));
              }}
              isValidConnection={(c) => c.source !== c.target}
              colorMode="system"
              deleteKeyCode={["Delete", "Backspace"]}
              minZoom={0.2}
              maxZoom={2}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--canvas-dots)" />
              <Controls showInteractive={false} />
            </ReactFlow>

            {/* Edit history */}
            <div className="absolute top-[68px] right-3 z-10 flex rounded-xl border lg:top-3 border-separator bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <IconButton label="Undo" shortcut={`${mod}Z`} onClick={undo} disabled={!past.current.length} align="end">
                <Undo2 size={20} aria-hidden />
              </IconButton>
              <IconButton label="Redo" shortcut={`${mod}⇧Z`} onClick={redo} disabled={!future.current.length} align="end">
                <Redo2 size={20} aria-hidden />
              </IconButton>
            </div>

            {/* Palette: a column on wide screens, a row on narrow ones */}
            <div
              role="group"
              aria-labelledby="palette-title"
              className="absolute top-3 left-3 z-10 flex items-center rounded-xl border border-separator bg-surface p-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] max-lg:right-3 max-lg:justify-between lg:w-36 lg:flex-col lg:items-stretch"
            >
              <p id="palette-title" className="px-2 text-xs font-medium text-label-2 max-lg:sr-only lg:pt-1 lg:pb-0.5">
                Add
              </p>
              {PALETTE.map((k) => {
                const Icon = KIND_META[k].icon;
                return (
                  <button
                    key={k}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/algolab-node", k);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => addNode(k)}
                    className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-1.5 text-left text-sm hover:bg-fill lg:w-full lg:gap-2.5 lg:px-2"
                    aria-describedby="palette-hint"
                  >
                    <Icon size={16} aria-hidden className="text-label-2" />
                    {KIND_META[k].label}
                  </button>
                );
              })}
              <span id="palette-hint" className="sr-only">
                Adds the node after the selected node, or drag it onto the canvas.
              </span>
            </div>

            {/* Validation status */}
            <div className="absolute right-3 bottom-3 z-10 flex max-w-[min(420px,calc(100%-1.5rem))] flex-col items-end">
              {issuesOpen && issueCount > 0 && (
                <ul className="scroll-thin mb-2 max-h-64 w-full overflow-y-auto rounded-xl border border-separator bg-surface shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                  {validation.errors.map((iss, k) => (
                    <li key={k} className="border-b border-separator last:border-0">
                      <button
                        type="button"
                        disabled={!iss.nodeId}
                        onClick={() => iss.nodeId && focusNode(iss.nodeId)}
                        className="flex min-h-11 w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-fill disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0 text-red" />
                        {iss.message}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                aria-expanded={issueCount ? issuesOpen : undefined}
                onClick={() => {
                  setShowIssues(true);
                  setIssuesOpen((o) => !o);
                }}
                className="flex h-11 items-center gap-2 rounded-lg border border-separator bg-surface px-3 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              >
                {issueCount ? (
                  <>
                    <TriangleAlert size={16} aria-hidden className="text-red" />
                    {`${issueCount} issue${issueCount > 1 ? "s" : ""} to fix`}
                  </>
                ) : (
                  <>
                    <CircleCheck size={16} aria-hidden className="text-green" />
                    Flowchart is valid
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Right panel */}
        <aside aria-label="Inspector, debugger and tests" className={`${pane("panel")} border-separator bg-bg lg:border-l`}>
          <div className="border-b border-separator p-2">
            <Segmented
              label="Panel"
              value={rightTab}
              onChange={setRightTab}
              className="flex w-full"
              options={[
                { value: "inspect", label: "Inspect" },
                { value: "debug", label: run ? "Debug ●" : "Debug" },
                { value: "tests", label: "Tests" },
              ]}
            />
          </div>
          <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
            {rightTab === "inspect" &&
              (selected ? (
                <Inspector
                  key={selected.id}
                  node={selected}
                  knownVars={knownVars}
                  ports={portChoices}
                  targets={portTargets}
                  onChange={(patch) => updateNode(selected.id, patch)}
                  onBeginEdit={commit}
                  onConnect={(port, target) => connectPort(selected.id, port, target)}
                  onDelete={() => deleteNode(selected.id)}
                />
              ) : (
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="text-lg font-semibold">Build your flowchart</h2>
                  <ul className="mt-2 space-y-2 text-sm leading-normal text-label-2">
                    <li>Select a node to edit it. Choose a block under Add to insert it after the selected node, or drag it onto the canvas.</li>
                    <li>Connect nodes by dragging from a node’s dot to another node, or pick the next step in this panel.</li>
                    <li>Select a node or connection and press Delete to remove it. Your chart is saved in this browser.</li>
                  </ul>
                  <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/guide/`} target="_blank" className={`${button.plain} mt-2 -ml-4 self-start`}>
                    Open the guide
                  </a>
                  <div className="mt-auto border-t border-separator pt-4">
                    <button type="button" onClick={() => setConfirmClear(true)} className={`${button.destructivePlain} w-full`}>
                      Clear chart
                    </button>
                  </div>
                </div>
              ))}
            {rightTab === "debug" && <DebugPanel run={run} cursor={cursor} setCursor={setCursor} nodes={nodes} onFocusNode={focusNode} />}
            {rightTab === "tests" && (
              <TestsPanel
                problem={problem}
                custom={custom}
                setCustom={setCustom}
                customError={customError}
                submission={submission}
                busy={!!busy}
                onCheckExamples={checkExamples}
                judgeAvailable={!!JUDGE_URL}
              />
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title={`Delete all nodes in “${problem.title}”?`}
        body="Start, Input and an empty Return stay. You can bring the nodes back with Undo."
        confirmLabel="Delete nodes"
        onConfirm={clearChart}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}

export function Workspace({ problem }: { problem: Problem }) {
  return (
    <ReactFlowProvider>
      <Editor problem={problem} />
    </ReactFlowProvider>
  );
}
