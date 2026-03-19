# Step 3a: Codebase Analysis

Run inline (no separate subagent needed — the PIR skill already runs in an isolated context). Save output to `.codebase-analysis-tmp/report.md`.

## Determine incident time range

Extract incident start and end timestamps from the discovery reports collected in step 2. Look for the earliest detection time and the resolution time across:
- `.pagerduty-oncall-tmp/report.md` — created/resolved timestamps
- `.datadog-analyser-tmp/report.md` — degradation timeline
- `.rollbar-reader-tmp/report.md` — first/last seen timestamps

Use these as `<incident_start>` and `<incident_end>` for git log. If only a start time is available, use `--until` as "now".

## Analyse git history

For each working directory (including any added via `--add-dir`):

1. Run `git fetch origin` to get latest refs
2. Run `git log origin/main --oneline --since="<incident_start>" --until="<incident_end>"` to find commits in the window
3. For any suspicious commits (deploy scripts, config changes, dependency bumps, service changes), run `git show origin/main:<file>` to examine the diff
4. Correlate commit timestamps with the incident timeline from the discovery reports

**Do NOT checkout main.** Use `git log origin/main` and `git show origin/main:<file>` only — read-only operations.

## Output

Write `.codebase-analysis-tmp/report.md` with a **definitive** conclusion — either:
- **"Culprit found: [description] — [evidence]"** when the root cause is confirmed, OR
- **"No culprit identified from codebase analysis"** when no causal link can be confirmed.

Never use hedging language.
