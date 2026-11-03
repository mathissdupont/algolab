// Page pattern: Detail — documentation article.
import { CirclePlay, CornerDownLeft, Diamond, Equal, LogIn, Repeat } from "lucide-react";
import type { Metadata } from "next";
import { Footer, Group, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Guide — AlgoLab" };

const NODES = [
  { icon: CirclePlay, name: "Start", outputs: "next", body: "Where execution begins. Exactly one per flowchart." },
  { icon: LogIn, name: "Input", outputs: "next", body: "Reads the problem’s input into variables. Added for you from the problem contract." },
  { icon: Equal, name: "Assign", outputs: "next", body: "Stores a value in a variable (count) or an element (result[i])." },
  { icon: Diamond, name: "Decision", outputs: "true, false", body: "Checks a condition and follows exactly one branch." },
  { icon: Repeat, name: "While", outputs: "body, exit", body: "Repeats the body while the condition holds. The body must lead back to the While node." },
  { icon: CornerDownLeft, name: "Return", outputs: "—", body: "Ends the run and returns the answer." },
];

const OPERATORS: [string, string][] = [
  ["+  -  *", "Arithmetic. + also joins text and arrays."],
  ["/", "Division with decimals: 7 / 2 is 3.5"],
  ["//  %", "Whole-number division and remainder, as in Python: -7 // 2 is -4"],
  ["==  !=  <  <=  >  >=", "Comparison. == compares arrays item by item."],
  ["and  or  not", "Logic; && || ! work too"],
  ["x in s,  x not in s", "Membership in text or an array"],
  ["xs[i],  grid[r][c]", "Indexing; negative indexes count from the end"],
  ["[1, 2, 3],  []", "Array literals"],
  ["true  false  null", "Literals; True, False and None work too"],
];

const FUNCTIONS: [string, string][] = [
  ["len(x)", "Length of an array or text"],
  ["append(xs, v)", "A new array with v added at the end"],
  ["slice(x, start, end)", "Part of an array or text, like x[start:end]"],
  ["array(n, fill)", "A new array of n copies of fill (default 0)"],
  ["min(…), max(…)", "Smallest or largest of the arguments, or of one array"],
  ["abs(n)", "Absolute value"],
  ["str(x), int(x)", "Convert to text or to a whole number"],
  ["lower(s), upper(s)", "Change letter case"],
  ["is_digit(s), is_letter(s)", "Check what kind of characters s holds"],
];

function CodeRows({ rows }: { rows: [string, string][] }) {
  return (
    <Group>
      <dl className="divide-y divide-separator">
        {rows.map(([code, desc]) => (
          <div key={code} className="px-4 py-3">
            <dt className="font-mono text-sm">{code}</dt>
            <dd className="mt-0.5 text-sm text-label-2">{desc}</dd>
          </div>
        ))}
      </dl>
    </Group>
  );
}

export default function GuidePage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pt-10 sm:pt-14">
        <h1 className="text-[2rem] leading-tight font-semibold">Flowchart guide</h1>
        <p className="mt-2 max-w-[65ch] text-label-2">
          Every flowchart is a real program. AlgoLab checks its structure, then runs it one node at a time.
        </p>

        <section className="mt-10" aria-labelledby="nodes">
          <SectionTitle id="nodes">Nodes</SectionTitle>
          <Group>
            <ul className="divide-y divide-separator">
              {NODES.map(({ icon: Icon, name, outputs, body }) => (
                <li key={name} className="flex gap-3 px-4 py-3">
                  <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-label-2" />
                  <div>
                    <div className="font-medium">
                      {name} <span className="ml-1 text-sm font-normal text-label-2">→ {outputs}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-label-2">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Group>
        </section>

        <section className="mt-10" aria-labelledby="expr">
          <SectionTitle id="expr">Expressions</SectionTitle>
          <p className="mb-4 max-w-[65ch] text-sm text-label-2">
            Expressions use a small Python-like language. AlgoLab reads them itself; they never run as JavaScript or Python.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <CodeRows rows={OPERATORS} />
            <CodeRows rows={FUNCTIONS} />
          </div>
        </section>

        <section className="mt-10" aria-labelledby="rules">
          <SectionTitle id="rules">Rules worth knowing</SectionTitle>
          <Group>
            <ul className="divide-y divide-separator text-sm">
              {[
                "Every output must be connected, and every node must be reachable from Start.",
                "A variable must be assigned on every path before it’s used. The checker names the one that’s missing.",
                "Arrays are copied when assigned: after b = a, changing b[0] leaves a alone.",
                "Conditions must be true or false. Numbers don’t count as true or false.",
                "A run stops after 200,000 steps or 2 seconds, so an endless loop shows an error instead of freezing the page.",
              ].map((r) => (
                <li key={r} className="px-4 py-3">
                  {r}
                </li>
              ))}
            </ul>
          </Group>
        </section>

        <section className="mt-10" aria-labelledby="keys">
          <SectionTitle id="keys">Keyboard</SectionTitle>
          <Group>
            <dl className="divide-y divide-separator text-sm">
              {[
                ["Delete or Backspace", "Remove the selected node or connection"],
                ["Ctrl+Z / ⌘Z", "Undo"],
                ["Ctrl+Shift+Z / ⌘⇧Z", "Redo"],
                ["Ctrl+Enter / ⌘↩", "Run the selected example"],
                ["F10", "Step forward"],
                ["Tab", "Move between controls; nodes can be connected from the Inspect panel without dragging"],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                  <dt>
                    <kbd className="rounded bg-fill px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
                  </dt>
                  <dd className="text-label-2">{v}</dd>
                </div>
              ))}
            </dl>
          </Group>
        </section>
      </main>
      <Footer />
    </>
  );
}
