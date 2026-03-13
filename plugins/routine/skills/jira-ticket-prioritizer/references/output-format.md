# Output Format

The prioritizer produces two JSON files in `.jira-ticket-prioritizer-tmp/`.

## output.json (presented to user)

Tickets grouped by dependency layer. Each layer contains a group of related tickets that can be worked on in parallel (no dependencies within a group). First ticket in each group is the primary ticket (used for branch naming).

```json
{
  "layers": [
    { "group": ["PROJ-100", "PROJ-104"], "relation": "same-epic", "hasFrontend": true },
    { "group": ["PROJ-101"], "relation": null, "hasFrontend": false }
  ],
  "skipped": [
    { "key": "PROJ-102", "reason": "depends on PROJ-100 (status: In Progress)" }
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
- ...and so on
- **layers[N].group** = ticket keys in this group, ordered by descending priority score. First ticket is the primary ticket.
- **layers[N].relation** = why these tickets are grouped (e.g. `"same-epic"`, `"same-feature"`, `"same-component"`, or `null` for single-ticket groups)
- **layers[N].hasFrontend** = whether any ticket in the group involves frontend/UI work (inferred from ticket summary, description, components, labels). Used by the orchestrator to decide whether to launch a dev environment for verification.
- **skipped** = Tickets with unresolved cross-layer dependencies. These are not processed — the next scheduler run re-evaluates them. Reason includes the dependency ticket key and its current JIRA status.
- **excluded** = Tickets intentionally omitted (container stories, Done/Closed/Resolved, etc.) with a reason string

### Ordering Rules

1. `layers` array is ordered by **dependency layer** (0, 1, 2, ...)
2. Within each group, tickets are ordered by **descending priority score**
3. Tickets within the same group have **no dependencies on each other**
4. Tickets with status Done/Closed/Resolved are placed in `excluded`
5. Container/parent stories with no implementable tasks of their own are placed in `excluded`
6. Tickets whose cross-layer dependencies are not yet resolved (dependency ticket status is not "Done") are placed in `skipped`

### Grouping Rules

Tickets are grouped in the same layer when they:
- Share the same epic/parent
- Are linked via "relates to" in JIRA
- Share the same component or feature area (semantic inference)
- Have no dependencies on each other

Tickets are NOT grouped together if one depends on the other — instead they go in separate layers.

---

## detailed-report.json (saved for reference, not displayed)

Full analysis with scores, justifications, and dependency graph.

```json
{
  "generated": "YYYY-MM-DD",
  "ticketCount": 5,
  "inputTickets": {
    "pending": ["PROJ-100", "PROJ-101", "PROJ-102", "PROJ-104"],
    "context": ["PROJ-98", "PROJ-99"]
  },
  "orderedTickets": [
    {
      "rank": 1,
      "key": "PROJ-100",
      "summary": "Fix auth",
      "type": "Bug",
      "priority": "High",
      "status": "To Do",
      "score": 87,
      "layer": 0,
      "group": ["PROJ-100", "PROJ-104"],
      "justification": "Blocks 2 tickets, high priority",
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
    "layers": [["PROJ-100", "PROJ-104"], ["PROJ-101"]],
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
  "skipped": [
    { "key": "PROJ-102", "dependency": "PROJ-100", "dependencyStatus": "In Progress", "reason": "cross-layer dependency not resolved" }
  ],
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
- `group` — ticket keys in this ticket's group
- `justification` — human-readable explanation of ranking
- `scores` — breakdown of individual factor scores (raw 1-5 values)

#### inputTickets
- `pending` — tickets with status To Do / Backlog (to be processed)
- `context` — tickets with other statuses (In Progress, Done, etc.) used for dependency resolution only

#### dependencyGraph
- `layers` — topological sort result, array of arrays
- `edges` — hard dependency edges from `linkedIssues`
- `softEdges` — semantic dependencies with confidence
- `cycles` — arrays of ticket keys forming cycles
- `externalDeps` — dependencies on tickets outside the input set

#### skipped
- Tickets with unresolved cross-layer dependencies
- `dependency` — the ticket key this is waiting on
- `dependencyStatus` — current JIRA status of the dependency

#### excluded
- Tickets skipped due to Done/Closed/Resolved status or container stories

#### warnings
- Cycle detection messages, bidirectional edge warnings, etc.
