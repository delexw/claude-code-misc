# Output Format

The prioritizer produces two JSON files in `.jira-ticket-prioritizer-tmp/`.

## output.json (presented to user)

A sorted array of JIRA ticket keys in recommended execution order:

```json
["PROJ-100", "PROJ-101", "PROJ-102", "PROJ-103"]
```

### Ordering Rules

1. Tickets are ordered by **dependency layer** first (layer 0 before layer 1, etc.)
2. Within the same layer, tickets are ordered by **descending priority score**
3. Tickets with status Done/Closed/Resolved are **excluded** from the array

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
