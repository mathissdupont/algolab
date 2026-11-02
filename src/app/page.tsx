import Link from "next/link";
import { problems, isSupported } from "@/lib/problems";

export default function Home() {
  const runnable = problems.filter(isSupported).length;
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24">
      <section className="pt-16 pb-14 sm:pt-24">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          Early access · {runnable} of {problems.length} problems runnable
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Design the algorithm before you write the code.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Build a flowchart that actually runs. Step through it node by node, watch every variable change, and test it
          against real cases — then carry the same logic into Python.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/problems/count-even/" className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white dark:text-[#0d0f13]">
            Start with Count Even Readings
          </Link>
          <Link href="/problems/" className="rounded-lg border border-line bg-panel px-5 py-2.5 font-medium">
            Browse all problems
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["1. Read the problem", "Every challenge comes with a typed input/output contract, constraints and worked examples."],
          ["2. Build a runnable flowchart", "Connect Input, Assign, Decision, While and Return nodes. Expressions are parsed and validated as you type."],
          ["3. Run, step, submit", "Execute on samples with a full variable trace, set breakpoints, then submit to the judge for hidden tests."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-xl border border-line bg-panel p-5">
            <h2 className="font-medium">{title}</h2>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="mt-14 rounded-xl border border-line bg-panel p-6">
        <h2 className="text-lg font-semibold">What works today</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
          <li>• Integers, booleans, strings, arrays (including nested)</li>
          <li>• Python-style arithmetic: + − * / // % and comparisons</li>
          <li>• Branching, while-loops, early returns</li>
          <li>• Step-by-step trace, breakpoints, variable diff</li>
          <li>• Structural validation incl. “used before assigned” checks</li>
          <li>• Step and time limits that stop infinite loops</li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          Problems that need sets, maps, stacks, queues, recursion or graph primitives are listed as <em>Coming soon</em> until the
          engine supports them.
        </p>
      </section>
    </main>
  );
}
