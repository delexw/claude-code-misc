# Redundancy Analysis Rules

Rules for detecting tickets that are redundant or duplicate within the DAG. Run after semantic dependency analysis (Step 4), before priority scoring (Step 5).

## Goal

Identify ticket pairs where one ticket's scope substantially overlaps with or is fully contained within another's. Surface these as skipped entries so the redundant ticket is not implemented twice.

## Detection Signals

Evaluate each pair of pending tickets against the following signals. Compute a **weight** (0.0–1.0) representing the degree of overlap, and a **confidence** level.

| Signal | Weight Range | Confidence |
|--------|-------------|------------|
| Explicit `duplicates` or `is duplicated by` JIRA link | 1.0 | high |
| Near-identical summary (≥80% token overlap after stopword removal) | 0.85–1.0 | high |
| Summary token overlap 50–79% AND same ticket type | 0.55–0.84 | medium |
| One ticket's description is a semantic subset of another's scope | 0.55–0.80 | medium |
| Same component(s) + same ticket type + similar description keywords | 0.40–0.65 | medium |
| Shared labels/components only, no textual similarity | 0.10–0.39 | low |

Weights within each range are determined by the strength of the match — use judgment to place within the range rather than always picking the midpoint.

## Confidence Rules

| Confidence | Criteria |
|------------|----------|
| high | Explicit JIRA duplicate link, OR near-identical summary (≥80% overlap), OR description is clearly a verbatim restatement |
| medium | Multiple overlapping signals (e.g. same component + similar summary + same type) but not identical |
| low | Single weak signal only (shared label or component, no textual similarity) |

When multiple signals match for the same pair, use the **highest** confidence level that applies and sum the weights (cap at 1.0).

## Primary Ticket Selection

When a redundant pair is found, one ticket is kept in the layers (primary) and the other is moved to `skipped`. Select the primary ticket by:

1. **Higher priority score** (from the composite scoring formula) — prefer the ticket that would rank higher
2. **Tiebreaker**: lower ticket number (e.g. PROJ-100 over PROJ-104)

The secondary ticket (lower score / higher number) is the redundant one that gets skipped.

## Output Behaviour by Confidence

| Confidence | Weight | Action |
|------------|--------|--------|
| high | any | Move secondary to `skipped`; note in detailed report |
| medium | ≥ 0.60 | Move secondary to `skipped`; note in detailed report |
| medium | < 0.60 | Not redundant — treat as independent tickets |
| low | any | Not redundant — treat as independent tickets |

## Skipped Entry Format

Redundant tickets placed in `skipped` use this structure in `output.json`:

```json
{
  "key": "PROJ-104",
  "reason": "redundant with PROJ-101 — <verbose evidence string>",
  "redundantWith": "PROJ-101",
  "weight": 0.87,
  "confidence": "high"
}
```

### Evidence String Guidelines

The `reason` field must be a single human-readable sentence that includes:
- The primary ticket key
- The specific signals that triggered the match (e.g. "near-identical summary", "overlapping component 'AuthService'", "description is a subset of PROJ-101 scope")
- Confidence and weight at the end

Example:
> `"redundant with PROJ-101 — near-identical summary and overlapping component 'AuthService'; PROJ-104 description is a subset of PROJ-101 scope (confidence: high, weight: 0.87)"`

Avoid vague reasons like "similar ticket" — always name the specific overlapping fields or text.

## Detailed Report Format

In `detailed-report.json`, redundancy findings are recorded under a `redundancies` array:

```json
{
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
  ]
}
```

Pairs that do not meet the threshold (low confidence, or medium confidence with weight < 0.60) are not recorded anywhere — they are simply treated as independent tickets.
