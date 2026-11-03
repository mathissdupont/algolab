// Page pattern: marketing — product landing.
import { ChevronRight, CornerDownLeft, Diamond, Equal, Repeat } from "lucide-react";
import Link from "next/link";
import flowIrExample from "../../docs/FLOW_IR_EXAMPLE.json";
import { button } from "@/components/styles";
import { Footer, Group, SectionTitle } from "@/components/ui";
import { formatValue } from "@/lib/engine/evaluate";
import { execute } from "@/lib/engine/interpreter";
import { FLOW_SCHEMA_VERSION, type FlowGraph } from "@/lib/engine/types";
import { getProblem, isSupported, problems } from "@/lib/problems";

// A real trace of ALG-E002, computed at build time by the same engine the editor runs.
function previewTrace() {
  const graph: FlowGraph = {
    schema_version: FLOW_SCHEMA_VERSION,
    nodes: flowIrExample.nodes.map((n) => ({ id: n.id, kind: n.kind as never, data: n.data })),
    edges: flowIrExample.edges,
  };
  const input = getProblem("count-even")!.sample_cases[0].input;
  const result = execute(graph, input, { trace: true });
  const at = result.trace.findIndex((t) => t.nodeId === "increment_count");
  return { graph, entry: result.trace[at], prev: result.trace[at - 1], step: at + 1, total: result.trace.length };
}

const KIND_ICON = { assign: Equal, decision: Diamond, while: Repeat, return: CornerDownLeft } as const;

function nodeText(n: FlowGraph["nodes"][number]): string {
  if (n.kind === "assign") return `${n.data.target} ← ${n.data.expression}`;
  if (n.kind === "while" || n.kind === "decision") return n.data.condition ?? "";
  if (n.kind === "return") return `return ${n.data.expression}`;
  return "";
}

function Preview() {
  const { graph, entry, prev, step, total } = previewTrace();
  const shown = graph.nodes.filter((n) => n.kind in KIND_ICON);
  return (
    <figure className="mx-auto mt-16 max-w-3xl">
      <Group className="shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between border-b border-separator px-4 py-3 text-sm text-label-2">
          <span>Count Even Readings · Example 1</span>
          <span>
            Step {step} of {total}
          </span>
        </div>
        <div className="grid sm:grid-cols-[1fr_220px]">
          <ol className="divide-y divide-separator">
            {shown.map((n) => {
              const Icon = KIND_ICON[n.kind as keyof typeof KIND_ICON];
              const active = n.id === entry.nodeId;
              return (
                <li key={n.id} className={`flex items-center gap-3 px-4 py-3 ${active ? "bg-accent-tint" : ""}`}>
                  <Icon size={16} aria-hidden className={active ? "text-accent" : "text-label-3"} />
                  <span className={`truncate font-mono text-sm ${active ? "text-accent" : ""}`}>{nodeText(n)}</span>
                  {active && <span className="ml-auto shrink-0 text-xs text-accent">current step</span>}
                </li>
              );
            })}
          </ol>
          <div className="border-t border-separator p-4 sm:border-t-0 sm:border-l">
            <div className="mb-2 text-sm font-semibold text-label-2">Variables</div>
            <dl className="space-y-2 font-mono text-sm">
              {Object.entries(entry.vars).map(([k, v]) => {
                const changed = prev && formatValue(prev.vars[k] ?? null) !== formatValue(v);
                return (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-label-2">{k}</dt>
                    <dd className="truncate text-right">
                      {formatValue(v)}
                      {changed && <span className="ml-1 text-accent">●</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </Group>
      <figcaption className="mt-3 text-center text-sm text-label-2">
        A real run of Count Even Readings, traced by AlgoLab’s engine when this page was built.
      </figcaption>
    </figure>
  );
}

export default function Home() {
  const runnable = problems.filter(isSupported).length;
  return (
    <>
      <main className="px-4">
        <section className="mx-auto max-w-3xl pt-16 text-center sm:pt-24">
          <h1 className="text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[3.5rem]">
            Design the algorithm before you write the code.
          </h1>
          <p className="mx-auto mt-6 max-w-[38ch] text-xl leading-normal text-label-2">
            Build a flowchart that runs. Step through it, watch every variable change, and test it against real cases.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/problems/count-even/" className={`${button.primary} rounded-full px-6 text-base`}>
              Start with Count Even Readings
            </Link>
            <Link href="/problems/" className={`${button.plain} text-base`}>
              Browse problems <ChevronRight size={18} aria-hidden />
            </Link>
          </div>
        </section>

        <Preview />

        <section className="mx-auto mt-24 grid max-w-5xl gap-10 lg:grid-cols-2">
          <div>
            <SectionTitle>How it works</SectionTitle>
            <Group>
              <ol className="divide-y divide-separator">
                {[
                  ["Read the problem", "A typed contract, constraints and two worked examples."],
                  ["Build the flowchart", "Connect Assign, Decision, While and Return nodes. Expressions are checked as you type."],
                  ["Step through it", "Run an example, then move step by step and watch each variable change."],
                  ["Judge your solution", "AlgoLab runs it on the examples and on hidden tests."],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-4 px-4 py-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fill text-sm font-semibold text-label-2">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-medium">{title}</div>
                      <p className="mt-0.5 text-sm leading-normal text-label-2">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Group>
          </div>
          <div>
            <SectionTitle>What’s included</SectionTitle>
            <Group>
              <dl className="divide-y divide-separator">
                {[
                  ["Problems", `${problems.length} original problems. ${runnable} can be solved today; the rest unlock as the engine grows.`],
                  ["Expressions", "A small Python-like language: arithmetic, comparisons, and/or/not, indexing, len and append."],
                  ["Debugger", "Step forward and back, breakpoints, a timeline and the full variable history."],
                  ["Safety", "Runs stop after 200,000 steps, so an endless loop shows an error instead of freezing the page."],
                  ["Privacy", "Drafts stay in this browser. Only the flowchart is sent, and only when you judge it."],
                ].map(([k, v]) => (
                  <div key={k} className="px-4 py-4">
                    <dt className="font-medium">{k}</dt>
                    <dd className="mt-0.5 text-sm leading-normal text-label-2">{v}</dd>
                  </div>
                ))}
              </dl>
            </Group>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
