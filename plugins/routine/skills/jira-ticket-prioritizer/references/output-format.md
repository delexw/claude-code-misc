# Output Format

The prioritizer produces two JSON files in `.jira-ticket-prioritizer-tmp/`.

## output.json (presented to user)

Ticket keys grouped by dependency layer, sorted by priority score within each layer:

```json
{
  "layers": [
    ["PROJ-100", "PROJ-104"],
    ["PROJ-101", "PROJ-102"],
    ["PROJ-103"]
  ],
  "excluded": [
    {
      "key": "PROJ-99",
      "reason": "Pure container story — no implementable tasks distinct from its sub-tasks"
    }
  ]
}
```

- **layers[0]** = Layer 0 (no blockers — work on these first)
- **layers[1]** = Layer 1 (depends on layer 0 being done)
- **layers[2]** = Layer 2 (depends on layer 1 being done)
- ...and so on
- **excluded** = Tickets intentionally omitted from layers (container stories, Done/Closed/Resolved, etc.) with a reason string

### Ordering Rules

1. `layers` array is ordered by **dependency layer** (0, 1, 2, ...)
2. Within each layer, tickets are ordered by **descending priority score**
3. Tickets with status Done/Closed/Resolved are placed in `excluded`
4. Container/parent stories with no implementable tasks of their own are placed in `excluded`

---

## detailed-report.json (saved for reference, not displayed)

Full analysis with scores, justifications, and dependency graph.

```json
{
  "generated": "YYYY-MM-DD",
  "ticketCount": 5,
  "orderedTickets": [
    {
      "rank": 1,
      "key": "PROJ-100",
      "summary": "Fix auth",
      "type": "Bug",
      "priority": "High",
      "status": "In Progress",
      "score": 87,
      "layer": 0,
      "justification": "Blocks 2 tickets, in progress",
      "scores": {
        "priority": 4,
        "type": 5,
        "downstream": 2,
        "momentum": 5,
        "staleness": 5,
        "contextBoost": 0
      }
    }
  ],
  "dependencyGraph": {
    "layers": [["PROJ-100"], ["PROJ-101", "PROJ-102"], ["PROJ-103"]],
    "edges": [
      { "from": "PROJ-100", "to": "PROJ-101", "type": "hard", "relationship": "blocks" }
    ],
    "softEdges": [
      { "from": "PROJ-100", "to": "PROJ-104", "confidence": "medium", "evidence": "shared auth module" }
    ],
    "cycles": [],
    "externalDeps": [
      { "key": "OTHER-50", "relationship": "blocks", "referencedBy": "PROJ-101" }
    ]
  },
  "excluded": [
    { "key": "PROJ-99", "summary": "Old task", "status": "Done", "reason": "completed" }
  ],
  "warnings": [],
  "context": "focus on backend"
}
```

### Field Details

#### orderedTickets
- `rank` — 1-indexed position in recommended order
- `key` — JIRA issue key
- `summary` — ticket title
- `type`, `priority`, `status` — from JIRA fields
- `score` — composite score (0-100)
- `layer` — dependency layer (0 = no blockers, 1 = depends on layer 0, etc.)
- `justification` — human-readable explanation of ranking
- `scores` — breakdown of individual factor scores (raw 1-5 values)

#### dependencyGraph
- `layers` — topological sort result, array of arrays
- `edges` — hard dependency edges from `linkedIssues`
- `softEdges` — semantic dependencies with confidence
- `cycles` — arrays of ticket keys forming cycles
- `externalDeps` — dependencies on tickets outside the input set

#### excluded
- Tickets skipped due to Done/Closed/Resolved status

#### warnings
- Cycle detection messages, bidirectional edge warnings, etc.
