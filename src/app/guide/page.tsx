import type { Metadata } from "next";

export const metadata: Metadata = { title: "Guide — AlgoLab" };

const NODES: [string, string, string][] = [
  ["Start", "next", "Where execution begins. Exactly one per flowchart."],
  ["Input", "next", "Binds the problem's input values to variables. Created for you from the problem contract."],
  ["Assign", "next", "Stores the value of an expression in a variable (count) or an element (result[i])."],
  ["Decision", "true / false", "Evaluates a condition and follows exactly one branch."],
  ["While", "body / exit", "Repeats the body while the condition is true. The body must lead back to the While node."],
  ["Return", "—", "Ends execution and returns the expression as the answer."],
];

const OPERATORS: [string, string][] = [
  ["+  -  *", "Arithmetic. + also joins strings and arrays."],
  ["/", "True division (7 / 2 = 3.5)"],
  ["//  %", "Floor division and modulo, Python semantics (-7 // 2 = -4, -7 % 3 = 2)"],
  ["==  !=  <  <=  >  >=", "Comparison. == compares arrays element by element."],
  ["and  or  not", "Boolean logic, short-circuiting (&&, ||, ! also accepted)"],
  ["x in s,  x not in s", "Membership in a string or array"],
  ["xs[i],  grid[r][c]", "Indexing; negative indexes count from the end"],
  ["[1, 2, 3],  []", "Array literals"],
  ["true  false  null", "Literals (True / False / None also accepted)"],
];

const FUNCTIONS: [string, string][] = [
  ["len(x)", "Length of an array or string (length(x) also works)"],
  ["append(xs, v)", "New array with v added at the end"],
  ["slice(x, start, end?)", "Part of an array or string, like x[start:end]"],
  ["array(n, fill?)", "New array of n copies of fill (default 0)"],
  ["min(...), max(...)", "Smallest / largest of the arguments, or of one array"],
  ["abs(n)", "Absolute value"],
  ["str(x), int(x)", "Convert to text / integer"],
  ["lower(s), upper(s)", "Change letter case"],
  ["is_digit(s), is_letter(s)", "Character class checks"],
];

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Flowchart guide</h1>
      <p className="mt-2 text-muted">
        Every flowchart is a real program. AlgoLab validates its structure, then executes it one node at a time.
      </p>

      <h2 className="mt-10 mb-3 text-lg font-semibold">Nodes</h2>
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-left">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="p-3">Node</th>
              <th className="p-3">Outputs</th>
              <th className="p-3">Behaviour</th>
            </tr>
          </thead>
          <tbody>
            {NODES.map(([n, o, b]) => (
              <tr key={n} className="border-b border-line last:border-0">
                <td className="p-3 font-medium">{n}</td>
                <td className="p-3 font-mono text-xs">{o}</td>
                <td className="p-3 text-muted">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 mb-3 text-lg font-semibold">Expressions</h2>
      <p className="mb-3 text-muted">
        Expressions use a small Python-like language. They are parsed by AlgoLab — never executed as JavaScript or Python.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {[OPERATORS, FUNCTIONS].map((rows, i) => (
          <div key={i} className="rounded-xl border border-line bg-panel">
            {rows.map(([code, desc]) => (
              <div key={code} className="border-b border-line p-3 last:border-0">
                <code className="font-mono text-xs text-accent">{code}</code>
                <p className="mt-1 text-muted">{desc}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-lg font-semibold">Rules worth knowing</h2>
      <ul className="space-y-2 text-muted">
        <li>• Every output port must be connected, and every node must be reachable from Start.</li>
        <li>• A variable must be assigned on <em>every</em> path before it is used — the validator tells you which one is missing.</li>
        <li>• Arrays are copied on assignment: after <code className="font-mono">b = a</code>, changing b[0] does not change a.</li>
        <li>• Conditions must be true or false; numbers are not treated as booleans.</li>
        <li>• Runs stop after 200,000 steps or 2 seconds, so an infinite loop shows an error instead of freezing the page.</li>
      </ul>

      <h2 className="mt-10 mb-3 text-lg font-semibold">Keyboard</h2>
      <ul className="space-y-1 text-muted">
        <li>
          <kbd className="font-mono">Delete</kbd> / <kbd className="font-mono">Backspace</kbd> — remove selected node or connection
        </li>
        <li>
          <kbd className="font-mono">Ctrl+Z</kbd> undo · <kbd className="font-mono">Ctrl+Shift+Z</kbd> / <kbd className="font-mono">Ctrl+Y</kbd> redo
        </li>
        <li>
          <kbd className="font-mono">Ctrl+Enter</kbd> run the selected example · <kbd className="font-mono">F10</kbd> step forward
        </li>
      </ul>
    </main>
  );
}
