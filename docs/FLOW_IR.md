# Flow IR v1.0

The execution model for AlgoLab flowcharts. The editor's React Flow state (positions, selection, breakpoints) is converted into this shape by [`toIR`](../src/lib/flow/convert.ts) before it is validated, executed, or submitted. The judge accepts only this shape.

```json
{
  "schema_version": "1.0",
  "nodes": [
    { "id": "start", "kind": "start", "data": {} },
    { "id": "input", "kind": "input", "data": { "bindings": [{ "name": "numbers", "type": "integer[]" }] } },
    { "id": "a1", "kind": "assign", "data": { "target": "count", "expression": "0" } },
    { "id": "w1", "kind": "while", "data": { "condition": "i < len(numbers)" } },
    { "id": "d1", "kind": "decision", "data": { "condition": "numbers[i] % 2 == 0" } },
    { "id": "r1", "kind": "return", "data": { "expression": "count" } }
  ],
  "edges": [{ "from": "start", "port": "next", "to": "input" }]
}
```

## Nodes and ports

| kind | data | output ports |
|---|---|---|
| `start` | — | `next` |
| `input` | `bindings[]` (name, display type) | `next` |
| `assign` | `target` (`x`, `xs[i]`, `grid[r][c]`), `expression` | `next` |
| `decision` | `condition` | `true`, `false` |
| `while` | `condition` | `body`, `exit` |
| `return` | `expression` | — |

Every output port must have exactly one edge. A node may have any number of incoming edges, except `start`, which can have none.

## Validation ([validate.ts](../src/lib/engine/validate.ts))

1. Schema version, size limits, unique ids, known kinds.
2. Exactly one `start`; at most one `input`, and it must bind every problem input; at least one `return`.
3. Edges must reference existing nodes and valid ports. No self-loops, no edges into `start`, no duplicate ports, no unconnected ports.
4. Every expression and target must parse.
5. Every node must be reachable from `start`, and some `return` must be reachable.
6. Each `while` body must be able to reach its own `while` node again.
7. **Definite assignment:** a forward must-analysis checks that each variable a node reads has been assigned on *every* path that reaches that node.

## Semantics ([interpreter.ts](../src/lib/engine/interpreter.ts))

- One step = executing one node. Each case starts with a fresh environment.
- Arrays have value semantics: assigning `b = a` stores a copy. `xs[i] = v` updates the array in place.
- Conditions must evaluate to booleans. Numbers are not truthy.
- `//` and `%` follow Python (floor). Negative indexes count from the end.
- Integer results outside ±2^53 raise `INTEGER_OVERFLOW`.
- Errors: `INVALID_GRAPH`, `PARSE_ERROR`, `UNDEFINED_VARIABLE`, `TYPE_MISMATCH`, `INDEX_OUT_OF_RANGE`, `DIVISION_BY_ZERO`, `UNKNOWN_FUNCTION`, `STEP_LIMIT_EXCEEDED`, `TIME_LIMIT_EXCEEDED`, `COLLECTION_LIMIT`, `INTEGER_OVERFLOW`, `MISSING_INPUT`.

## Judging ([judge.ts](../src/lib/engine/judge.ts))

The graph is validated once, then each case runs with no trace and a step budget (`JUDGE_LIMITS`). Results for public cases include the input, the expected output, and the actual output. Results for private cases include only the status, the step count, and the error code.
