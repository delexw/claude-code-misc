# Step 3a: Codebase Analysis

Launch a **Task subagent** for codebase analysis. The Task must save its output to `.codebase-analysis-tmp/report.md`.

Perform codebase analysis in all current working directories (any additional directories added via `--add-dir`):

For each working directory:
1. `cd` into the directory
2. Run `git fetch origin` to get latest refs
3. Run `git log origin/main --oneline --since="<incident_start>" --until="<incident_end>"` to find relevant commits
4. For suspicious commits, run `git show origin/main:<file>` to examine changes
5. Correlate commit timestamps with incident timeline from discovery reports

**IMPORTANT**: Do NOT checkout main. Use `git log origin/main` and `git show origin/main:<file>` only.

The analysis must produce a **definitive** conclusion — either:
- **"Culprit found: [description] — [evidence]"** when the root cause is confirmed, OR
- **"No culprit identified from codebase analysis"** when no causal link can be confirmed.

NEVER use hedging language.
