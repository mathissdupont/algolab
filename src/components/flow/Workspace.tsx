"use client";

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
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useIsDark } from "@/components/ThemeToggle";
import { ProblemPanel } from "@/components/ProblemPanel";
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

function Editor({ problem }: { problem: Problem }) {
  const rf = useReactFlow<RFNode, RFEdge>();
  const dark = useIsDark();
  const expectedInputs = useMemo(() => inputNames(problem), [problem]);

  const [nodes, setNodes] = useState<RFNode[]>(() => withFlags(starterDraft(problem).nodes));
  const [edges, setEdges] = useState<RFEdge[]>(() => starterDraft(problem).edges);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("inspect");
  const [mobileTab, setMobileTab] = useState<MobileTab>("flow");
  const [showIssues, setShowIssues] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);

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
  const displayEdges = useMemo(() => {
    if (!fromId || !activeId) return edges;
    const entry = trace[cursor - 1];
    const port = entry?.note?.split("→ ")[1] ?? "next";
    return edges.map((e) => (e.source === fromId && e.target === activeId && (e.sourceHandle ?? "next") === port ? { ...e, className: "is-taken", animated: true } : e));
  }, [edges, fromId, activeId, trace, cursor]);

  // ── Graph editing ───────────────────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange<RFNode>[]) => setNodes((ns) => applyNodeChanges(changes, ns)), []);
  const onEdgesChange = useCallback((changes: EdgeChange<RFEdge>[]) => setEdges((es) => applyEdgeChanges(changes, es)), []);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.sourceHandle || c.source === c.target) return;
      commit();
      setEdges((es) =>
        es.filter((e) => !(e.source === c.source && e.sourceHandle === c.sourceHandle)).concat(makeEdge(c.source, c.sourceHandle!, c.target, c.targetHandle)),
      );
    },
    [commit],
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
        position = { x: selected.position.x + (sideways ? 240 : 0), y: selected.position.y + (sideways ? 40 : 110) };
      }
      if (!position) {
        const el = document.querySelector(".react-flow")?.getBoundingClientRect();
        const center = el ? { x: el.left + el.width / 2, y: el.top + el.height / 2 } : { x: 400, y: 300 };
        position = rf.screenToFlowPosition(center);
        position = { x: position.x - 75 + (nodes.length % 5) * 12, y: position.y - 20 + (nodes.length % 5) * 12 };
      }
      // Nudge the new node until it doesn't sit on top of an existing one.
      const overlaps = (p: { x: number; y: number }) =>
        nodes.some((n) => Math.abs(n.position.x - p.x) < (n.measured?.width ?? 170) && Math.abs(n.position.y - p.y) < (n.measured?.height ?? 50) + 12);
      for (let tries = 0; tries < 40 && overlaps(position); tries++) {
        position = freePort === "false" || freePort === "exit" ? { x: position.x + 60, y: position.y } : { x: position.x, y: position.y + 70 };
      }
      const node: RFNode = { id, type: "flow", position, data: newNodeData(kind), selected: true };
      setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)).concat(node));
      if (!at && selected && freePort) setEdges((es) => es.concat(makeEdge(selected.id, freePort, id)));
      const rect = document.querySelector(".react-flow")?.getBoundingClientRect();
      const screen = rf.flowToScreenPosition(position);
      if (rect && (screen.x < rect.left || screen.x + 160 > rect.right || screen.y < rect.top || screen.y + 60 > rect.bottom)) {
        rf.setCenter(position.x + 80, position.y + 30, { zoom: rf.getZoom(), duration: 250 });
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
      addNode(kind, { x: p.x - 75, y: p.y - 20 });
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
      rf.setCenter(n.position.x + 80, n.position.y + 30, { zoom: Math.max(rf.getZoom(), 0.9), duration: 300 });
    },
    [nodes, rf],
  );

  const resetToStarter = () => {
    if (!confirm("Replace your flowchart with the empty starter? Your current draft will be lost.")) return;
    commit();
    const s = starterDraft(problem);
    setNodes(withFlags(s.nodes));
    setEdges(s.edges);
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
        setCustomError(`'${name}' is not valid JSON`);
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
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        handlers.current.startRun("run");
      } else if (e.key === "F10") {
        e.preventDefault();
        handlers.current.stepForward();
      } else if (!typing && mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) handlers.current.redo();
        else handlers.current.undo();
      } else if (!typing && mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handlers.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = nodes.find((n) => n.id === selectedId);
  const issueCount = validation.errors.length;

  const btn = "h-8 rounded-md border border-line bg-panel px-2.5 text-xs font-medium hover:border-accent disabled:opacity-40 disabled:hover:border-line";
  const pane = (tab: MobileTab) => `${mobileTab === tab ? "flex" : "hidden"} lg:flex min-h-0 flex-col`;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Mobile pane switcher */}
      <div className="flex border-b border-line bg-panel lg:hidden" role="tablist">
        {(["problem", "flow", "panel"] as MobileTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={mobileTab === t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-2 text-sm capitalize ${mobileTab === t ? "border-b-2 border-accent font-medium" : "text-muted"}`}
          >
            {t === "flow" ? "Flowchart" : t === "panel" ? "Debug & tests" : "Problem"}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(280px,26%)_1fr_minmax(300px,24%)]">
        {/* Problem */}
        <aside className={`${pane("problem")} scroll-thin overflow-y-auto border-line bg-panel lg:border-r`}>
          <ProblemPanel problem={problem} />
        </aside>

        {/* Canvas */}
        <section className={`${pane("flow")} relative`}>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-panel px-2 py-1.5">
            <select
              value={caseChoice}
              onChange={(e) => setCaseChoice(Number(e.target.value))}
              className="h-8 rounded-md border border-line bg-panel px-2 text-xs"
              aria-label="Input to run"
            >
              {problem.sample_cases.map((_, i) => (
                <option key={i} value={i}>
                  Example {i + 1}
                </option>
              ))}
              <option value={-1}>Custom input</option>
            </select>
            <button
              onClick={() => startRun("run")}
              disabled={!!busy}
              className="h-8 rounded-md bg-accent px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 dark:text-[#0d0f13]"
              title="Run (Ctrl+Enter)"
            >
              ▶ Run
            </button>
            <button onClick={stepBack} disabled={!run || cursor === 0} className={btn} title="Step back">
              ◀
            </button>
            <button onClick={stepForward} disabled={!!busy || (!!run && cursor >= trace.length - 1)} className={btn} title="Step forward (F10)">
              Step ▶
            </button>
            <button onClick={continueRun} disabled={!!busy || (!!run && cursor >= trace.length - 1)} className={btn} title="Continue to next breakpoint">
              Continue ⏭
            </button>
            <button onClick={() => setRun(null)} disabled={!run} className={btn} title="Clear the current run">
              Reset
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={undo} disabled={!past.current.length} className={btn} title="Undo (Ctrl+Z)" aria-label="Undo">
                ↶
              </button>
              <button onClick={redo} disabled={!future.current.length} className={btn} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
                ↷
              </button>
              <button
                onClick={submit}
                disabled={!!busy}
                className={`${btn} border-ok text-ok`}
                title={JUDGE_URL ? "Judge on public and hidden tests" : "Judge server not configured: checks public examples only"}
              >
                {busy === "submit" ? "Judging…" : JUDGE_URL ? "Submit" : "Check examples"}
              </button>
            </div>
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
              colorMode={dark ? "dark" : "light"}
              deleteKeyCode={["Delete", "Backspace"]}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: false }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="var(--canvas-dots)" />
              <Controls showInteractive={false} />
            </ReactFlow>

            {/* Palette */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 rounded-lg border border-line bg-panel p-1.5 shadow-sm">
              <span className="px-1 text-[10px] font-semibold tracking-wide text-muted uppercase">Add</span>
              {PALETTE.map((k) => (
                <button
                  key={k}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/algolab-node", k);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => addNode(k)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-panel-2"
                  title={`${KIND_META[k].hint}. Click to add${selected ? " after the selected node" : ""}, or drag onto the canvas.`}
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND_META[k].color }} />
                  {KIND_META[k].label}
                </button>
              ))}
              <hr className="my-1 border-line" />
              <button onClick={resetToStarter} className="rounded-md px-2 py-1 text-left text-[11px] text-muted hover:bg-panel-2 hover:text-fg">
                Reset chart
              </button>
            </div>

            {/* Validation status */}
            <div className="absolute right-3 bottom-3 z-10 max-w-[min(420px,calc(100%-1.5rem))]">
              {issuesOpen && issueCount > 0 && (
                <ul className="scroll-thin mb-2 max-h-56 overflow-y-auto rounded-lg border border-line bg-panel p-1 text-xs shadow-lg">
                  {validation.errors.map((iss, k) => (
                    <li key={k}>
                      <button
                        disabled={!iss.nodeId}
                        onClick={() => iss.nodeId && focusNode(iss.nodeId)}
                        className="w-full rounded px-2 py-1.5 text-left hover:bg-panel-2 disabled:cursor-default"
                      >
                        <span className="text-bad">●</span> {iss.message}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => {
                  setShowIssues(true);
                  setIssuesOpen((o) => !o);
                }}
                className={`ml-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm ${
                  issueCount ? "border-warn/50 bg-warn-soft text-warn" : "border-ok/50 bg-ok-soft text-ok"
                }`}
              >
                {issueCount ? `${issueCount} issue${issueCount > 1 ? "s" : ""} to fix` : "✓ Flowchart is valid"}
              </button>
            </div>
          </div>
        </section>

        {/* Right panel */}
        <aside className={`${pane("panel")} border-line bg-panel lg:border-l`}>
          <div className="flex border-b border-line" role="tablist">
            {(["inspect", "debug", "tests"] as RightTab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={rightTab === t}
                onClick={() => setRightTab(t)}
                className={`flex-1 py-2 text-xs font-medium capitalize ${rightTab === t ? "border-b-2 border-accent text-fg" : "text-muted hover:text-fg"}`}
              >
                {t}
                {t === "debug" && run && <span className="ml-1 text-accent">●</span>}
              </button>
            ))}
          </div>
          <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
            {rightTab === "inspect" &&
              (selected ? (
                <Inspector
                  key={selected.id}
                  node={selected}
                  knownVars={knownVars}
                  onChange={(patch) => updateNode(selected.id, patch)}
                  onBeginEdit={commit}
                  onDelete={() => deleteNode(selected.id)}
                />
              ) : (
                <div className="space-y-3 p-4 text-sm text-muted">
                  <p>Select a node to edit it.</p>
                  <ul className="space-y-1.5 text-xs">
                    <li>• Click a block in <b className="text-fg">Add</b> to insert it after the selected node, or drag it onto the canvas.</li>
                    <li>• Drag from a node’s bottom/right dot to another node to connect them. Connecting a used port replaces its old connection.</li>
                    <li>• Select a node or connection and press Delete to remove it.</li>
                    <li>• Your chart is saved automatically in this browser.</li>
                  </ul>
                  <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/guide/`} target="_blank" className="inline-block text-xs text-accent underline">
                    Expression & node reference ↗
                  </a>
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
