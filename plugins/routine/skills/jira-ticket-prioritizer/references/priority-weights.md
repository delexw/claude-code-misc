# Priority Scoring Weights

Tickets at the same dependency layer are ranked by a weighted composite score (0–100).

## Factors

| Factor | Weight | Scoring |
|--------|--------|---------|
| JIRA Priority field | 30% | Critical=5, High=4, Medium=3, Low=2, Lowest=1 |
| Ticket Type | 25% | Bug=5, Story=4, Task=3, Sub-task=2, Epic=1 |
| Downstream Impact | 20% | Count of tickets in the input set that depend on this one |
| Status Momentum | 15% | In Progress=5, In Review=4, To Do=3, Backlog=2, other=1 |
| Staleness | 10% | Based on days since last update (see below) |

## Priority Field Mapping

| JIRA Priority | Score |
|---------------|-------|
| Critical / Blocker | 5 |
| High / Urgent | 4 |
| Medium / Normal | 3 |
| Low | 2 |
| Lowest / Trivial | 1 |
| (unset / unknown) | 3 |

## Ticket Type Mapping

| Type | Score |
|------|-------|
| Bug / Defect | 5 |
| Story / User Story | 4 |
| Task / Improvement | 3 |
| Sub-task | 2 |
| Epic | 1 |
| (other) | 3 |

## Downstream Impact

- Count how many tickets in the input set have a direct dependency on this ticket (it blocks them)
- Include both hard edges (from `linkedIssues`) and soft edges (from semantic analysis)
- Normalize: `score = min(count, 5)` — cap at 5

## Status Momentum

Tickets already in motion should be prioritized to keep work flowing.

| Status | Score |
|--------|-------|
| In Progress | 5 |
| In Review / Code Review | 4 |
| To Do / Selected for Development | 3 |
| Backlog / Open | 2 |
| (other non-done) | 1 |

Skip tickets with status **Done**, **Closed**, **Resolved** — list as excluded.

## Staleness

More recently updated tickets score higher (active work is preferable).

| Days Since Update | Score |
|-------------------|-------|
| 0-3 | 5 |
| 4-7 | 4 |
| 8-14 | 3 |
| 15-30 | 2 |
| 31+ | 1 |

## Composite Score Formula

```
raw = (priority_score * 0.30)
    + (type_score * 0.25)
    + (downstream_score * 0.20)
    + (momentum_score * 0.15)
    + (staleness_score * 0.10)

final_score = round(raw / 5 * 100)
```

## Context Boost

When EXTRA_CONTEXT provides additional context:
- Match context keywords against ticket `labels`, `components`, `summary`, and `description`
- Apply a +5 bonus to the final score for matching tickets
- This acts as a tiebreaker, not a dominant factor
