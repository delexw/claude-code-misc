# Dependency Analysis Rules

Rules for detecting and mapping dependencies between JIRA tickets.

## Parent/Container Ticket Evaluation

Detect parent/child relationships using two signals:
- **`parent.key`** — a ticket's `parent.key` matches another ticket in the input set (child pointing up)
- **`subtasks`** — a ticket has a `subtasks` array listing its children (parent pointing down)

When a parent/child relationship is found, evaluate whether the parent is a pure container or has its own implementable work:

- **Pure container** — the parent's description is empty, a placeholder, or only summarizes child work. Exclude it from the output layers and note it in the detailed report.
- **Has own work** — the parent has a concrete description with implementable tasks distinct from its children. Keep it in the graph.

This is a judgment call during semantic analysis (Step 4), not an automatic exclusion.

## Explicit Dependencies (from linkedIssues)

The `linkedIssues` array from each ticket contains relationship types. Map these to directed graph edges:

### Relationship Mapping

| Relationship String | Edge Direction | Notes |
|---------------------|---------------|-------|
| `blocks` | from → to (blocker before blocked) | Hard dependency |
| `is blocked by` | to → from (reverse) | Hard dependency |
| `causes` | from → to | Hard dependency |
| `is caused by` | to → from | Hard dependency |
| `has to be done before` | from → to | Hard dependency |
| `has to be done after` | to → from | Hard dependency |
| `relates to` | No hard edge | Flag for semantic analysis |
| `duplicates` / `is duplicated by` | Skip | Not a dependency |
| `clones` / `is cloned by` | Skip | Not a dependency |

### Edge Rules
- Only create edges between tickets **in the input set**
- If a linked ticket is **not** in the input set, record it as an external dependency
- If both directions exist (A blocks B AND B blocks A), flag as a potential cycle

## Semantic Dependencies (LLM Analysis)

For tickets with `relates to` links or no explicit dependency links, perform semantic analysis.

### Signals to Look For

1. **Ticket key references** — Description or comments mentioning other ticket keys in the input set (e.g. "after PROJ-101 is done")
2. **Shared components** — Tickets modifying the same module, file, or component (from `components`, `labels`, or description mentions)
3. **Functional ordering** — Keywords indicating sequence:
   - **Strong signals** (high confidence): "depends on", "requires", "blocked by", "after X is done", "prerequisite"
   - **Medium signals** (medium confidence): "builds on", "extends", "uses output from", "needs X first"
   - **Weak signals** (low confidence): "related to", "similar to", "see also", shared labels/components
4. **Data/API dependencies** — One ticket creates a data model or API that another ticket consumes
5. **Infrastructure dependencies** — One ticket sets up infrastructure (DB migration, config) that another ticket uses

### Confidence Levels

| Level | Criteria | Graph Treatment |
|-------|----------|----------------|
| high | Explicit textual reference to dependency ("requires PROJ-100") | Add as soft edge, include in topological sort |
| medium | Shared component + ordering hint | Add as soft edge, include in topological sort |
| low | Shared labels/components only, no ordering hint | Note in report, do NOT add to sort |

### Evidence Recording

For each semantic dependency, record:
- `from`: the prerequisite ticket key
- `to`: the dependent ticket key
- `confidence`: high / medium / low
- `evidence`: brief explanation (e.g. "PROJ-101 description references PROJ-100 auth module")

## External Dependencies

Tickets referenced in `linkedIssues` that are not in the input set:
- Record the key, relationship, and which input ticket references it
- Flag if the external ticket has status that could block work (e.g. "Open", "In Progress")
- Do NOT fetch external tickets — just note them

## Grouping Rules

After dependency layers are determined, group related tickets **within the same layer**. Grouped tickets can be worked on in parallel and their changes merged together for verification.

### Grouping Signals (in order of strength)

1. **Same epic/parent** — tickets sharing the same `parent.key` or epic
2. **"Relates to" JIRA link** — tickets linked via "relates to" in the same layer
3. **Same component** — tickets sharing JIRA `components` values
4. **Semantic similarity** — tickets modifying the same feature area (inferred from summary, description, labels)

### Grouping Constraints

- Tickets in the same group must have **no dependencies on each other** (if A depends on B, they go in separate layers, not the same group)
- First ticket in each group is the **primary ticket** (highest priority score) — used for merge branch naming
- Single-ticket groups have `relation: null`
- Multi-ticket groups have a `relation` string describing why they're grouped (e.g. `"same-epic"`, `"same-component"`, `"same-feature"`)

## Cycle Handling

If Kahn's algorithm detects a cycle (remaining nodes with non-zero in-degree after sort completes):
1. Report the cycle in the output
2. Break the cycle by removing the edge with the weakest justification (soft edges first, then the most recently added hard edge)
3. Re-run the sort
4. Note the broken edge in warnings
