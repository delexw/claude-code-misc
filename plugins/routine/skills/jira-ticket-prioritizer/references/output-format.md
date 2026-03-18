# Output Format

The prioritizer produces two JSON files in `.jira-ticket-prioritizer-tmp/`.

## output.json (presented to user)

Topologically-sorted array of groups forming a dependency DAG. Each group contains related tickets with no internal dependencies. First ticket in each group is the primary ticket (group identifier). Groups declare their parent via `depends_on`.

```json
{
  "layers": [
    { "group": [
        {"key": "PROJ-100", "complexity": "trivial", "repos": [{"repo": "acme-api", "branch": "proj-100-fix-auth-bug"}]},
        {"key": "PROJ-104", "complexity": "moderate", "repos": [{"repo": "acme-web", "branch": "proj-104-update-login-ui"}, {"repo": "acme-api", "branch": "proj-104-add-api-endpoint"}]}
      ], "relation": "same-epic", "verification": {"required": true, "reason": "PROJ-104 updates login UI rendered on /login page"}, "depends_on": null },
    { "group": [{"key": "PROJ-101", "complexity": "complex", "repos": [{"repo": "acme-api", "branch": "proj-101-add-rate-limiting"}]}], "relation": null, "verification": {"required": false, "reason": "API-only change, no visible UI"}, "depends_on": "PROJ-100" },
    { "group": [{"key": "PROJ-105", "complexity": "moderate", "repos": [{"repo": "acme-web", "branch": "proj-105-dashboard"}]}], "relation": null, "verification": {"required": true, "reason": "new dashboard page"}, "depends_on": null }
  ],
  "skipped": [
    { "key": "PROJ-102", "reason": "depends on PROJ-100 (status: In Progress)" },
    { "key": "PROJ-104", "reason": "redundant with PROJ-101 — near-identical summary and overlapping component 'AuthService'; PROJ-104 description is a subset of PROJ-101 scope (confidence: high, weight: 0.87)", "redundantWith": "PROJ-101", "weight": 0.87, "confidence": "high" }
  ],
  "excluded": [
    {
      "key": "PROJ-99",
      "reason": "Pure container story — no implementable tasks distinct from its sub-tasks"
    }
  ]
}
```

- **layers** = flat, topologically-sorted array of groups. One group per entry, processed sequentially in order.
- **layers[N].group** = ticket assignments in this group, ordered by descending priority score. Each entry is `{"key": "TICKET-KEY", "complexity": "trivial|moderate|complex", "repos": [{"repo": "repo-basename", "branch": "slugified-branch-name"}, ...]}`. A ticket may touch one or more repos. `repo`, `branch`, and `complexity` are REQUIRED for every entry. The `repo` is the target repository basename inferred from ticket context and the available repo list. The `branch` is a slugified branch name from ticket key + summary (lowercase, hyphens, max 50 chars, e.g. `"ec-123-fix-payment-bug"`). The `complexity` is one of `trivial`, `moderate`, or `complex` (see Step 5 for classification rules). First ticket is the primary ticket (group identifier).
- **layers[N].relation** = why these tickets are grouped (e.g. `"same-epic"`, `"same-feature"`, `"same-component"`, or `null` for single-ticket groups)
- **layers[N].depends_on** = **REQUIRED**. Ticket key of the parent group this depends on, or `null` for root groups. See Dependency DAG Rules below.
- **layers[N].verification** = object `{"required": boolean, "reason": string}` indicating whether the group's changes should be visually verified via a running dev server.
  - **required** = `true` only when changes produce **visible, reachable UI** — e.g. a component rendered on an existing page. Set to `false` when: (a) backend/API-only, (b) new component not yet mounted on any page, (c) UI behind a feature flag that is off by default, (d) purely styling tokens or test changes. Inferred semantically from ticket content.
  - **reason** = short explanation of why `required` is true or false. Used for logging and debugging orchestrator decisions.
- **skipped** = Tickets not processed this run, for one of two reasons:
  - *Unresolved dependency*: cross-layer dependency ticket is not yet Done. Reason includes the dependency key and its current status.
  - *Redundant*: ticket substantially overlaps with a higher-scoring ticket. Includes `redundantWith`, `weight`, and `confidence` fields. Reason is a verbose evidence string naming the specific overlapping fields.
- **excluded** = Tickets intentionally omitted (container stories, Done/Closed/Resolved, etc.) with a reason string

### Ordering Rules

1. Within each group, tickets are ordered by **descending priority score**
2. Tickets within the same group have **no dependencies on each other**
3. Tickets with status Done/Closed/Resolved are placed in `excluded`
4. Container/parent stories with no implementable tasks of their own are placed in `excluded`
5. Tickets whose cross-layer dependencies are not yet resolved (dependency ticket status is not "Done") are placed in `skipped`
6. Tickets identified as redundant (confidence: high, OR confidence: medium + weight ≥ 0.60) are placed in `skipped` — the lower-scoring ticket is skipped, the higher-scoring one proceeds

### Dependency DAG Rules

- `depends_on` is **REQUIRED** on every group — set to the ticket key of the parent group, or `null` for root groups
- `depends_on` may reference any ticket in the parent group (not just the first) — the pipeline resolves it to the group
- `depends_on` MUST reference a group that appears **earlier** in the `layers` array (never same position or later)
- Multiple groups may depend on the same parent (fan-out / diamond)
- A group with `"depends_on": null` is a **root** — it branches from main independently, regardless of its position in the array

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
  "redundancies": [
    {
      "primary": "PROJ-101",
      "secondary": "PROJ-104",
      "weight": 0.87,
      "confidence": "high",
      "signals": ["near-identical summary", "overlapping component 'AuthService'", "description subset"],
      "action": "skipped",
      "evidence": "near-identical summary and overlapping component 'AuthService'; PROJ-104 description is a subset of PROJ-101 scope"
    }
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
- Tickets with unresolved cross-layer dependencies, OR redundant tickets
- `dependency` — (dependency-skipped only) the ticket key this is waiting on
- `dependencyStatus` — (dependency-skipped only) current JIRA status of the dependency
- `redundantWith` — (redundant only) the primary ticket key this was found redundant with
- `weight` — (redundant only) overlap weight 0.0–1.0
- `confidence` — (redundant only) high / medium

#### redundancies
- Full redundancy analysis findings (both skipped and warning-only pairs)
- `primary` / `secondary` — ticket keys; secondary is the one skipped or warned about
- `weight`, `confidence` — as above
- `signals` — list of specific overlap signals detected
- `action` — always `"skipped"` (only pairs that meet the threshold are recorded here)
- `evidence` — verbose explanation used in the `reason` string

#### excluded
- Tickets skipped due to Done/Closed/Resolved status or container stories

#### warnings
- Cycle detection messages, bidirectional edge warnings, etc.
