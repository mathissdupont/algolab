# Suggested Early-Access Problem Order

**Important:** The entire 60-problem content bank is prepared, but users should only be shown problems supported by implemented engine features. This list is a progressive rollout proposal, not an indication that the app or engine already exists.

## Foundation — first 10

1. ALG-E002 — Count Even Readings
2. ALG-E001 — Sum the Readings
3. ALG-E003 — Highest Sensor Value
4. ALG-E004 — First Matching Position
5. ALG-E010 — Frequency of a Code
6. ALG-E009 — Sorted Order Check
7. ALG-E011 — Running Energy Total
8. ALG-E017 — Longest Online Streak
9. ALG-E005 — Reverse the Message (requires string indexing)
10. ALG-E007 — Vowel Counter (requires character predicates)

## Once collection features are available

- ALG-E008 — Count Different Codes (set)
- ALG-E013 — First Pair Matching a Target (map or nested loops)
- ALG-E014 — First Position in Sorted Data (binary-search control flow)
- ALG-E012 — Merge Two Sensor Logs (two pointers)
- ALG-M001 — Best Single Trade (greedy)
- ALG-M002 — Longest Unique-Character Window (set and sliding window)
- ALG-M003 — Bracket Sequence Validator (stack)
- ALG-M006 — Shortest Sufficient Segment (sliding window)

## Advanced rollout examples

- ALG-M016 — Count Land Regions (grid traversal)
- ALG-M017 — Shortest Warehouse Walk (BFS queue)
- ALG-M018 — Equal Load Split (DP)
- ALG-H001 — Median Across Sorted Streams (partition binary search)
- ALG-H010 — Least-Cost Directed Path (priority queue)
- ALG-H013 — Count Nonattacking Queen Layouts (recursion)

**Launch gating:** Check `required_features` on every JSON problem. Unsupported features should trigger a clearly labeled 'Coming soon' state, not a broken interactive editor.
