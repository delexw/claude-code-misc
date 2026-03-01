# Step 4: Codebase Analysis — Root Cause Investigation

**Condition**: Only run this step if `$ARGUMENTS[2]` (repos list) is provided.

**Run via Task subagent** to isolate context:

Use the Task tool and a prompt like:

> Investigate recent commits that may have caused or contributed to the following incidents:
>
> **Incidents**: [list incident titles, services, and timestamps from Step 2]
>
> **Repos to investigate**: $ARGUMENTS[2]
>
> For each repo, run:
> - `git fetch origin main` to ensure origin/main is up to date
> - `git log origin/main --since="<incident_start minus 24h>" --until="<incident_end>" --oneline` to find recent commits near the incident window
> - `git show origin/main:<file>` to read relevant source code when a suspicious commit is found
>
> **IMPORTANT**: Do NOT checkout main. Use `git log origin/main` and `git show origin/main:<file>` only.
>
> Correlate incident timestamps with recent deploys and code changes to identify culprit commits. Look for:
> - Config changes, feature flag toggles, or environment variable updates
> - Changes to error handling, retry logic, or timeouts
> - Database migration or schema changes
> - Dependency version bumps
> - Changes to the specific services or endpoints mentioned in the incidents
>
> Read relevant source code from origin/main to provide constructive cause analysis with specific file and code references.
>
> Save the full analysis to `.codebase-analysis-tmp/report.md` with this structure:
> - **Repo**: repo name
> - **Suspicious commits**: hash, author, date, message
> - **Code references**: file paths and relevant code snippets
> - **Correlation**: how the change relates to the incident timeline and symptoms
> - **Confidence**: High / Medium / Low

**Extract from report** (`.codebase-analysis-tmp/report.md`):
- Suspicious commits near incident timestamps → **Culprit**
- Code changes that explain observed failures → **What**, **Culprit**
- Deploy timestamps that correlate with incident start → **When**
- Specific file and code references → **Culprit** detail

**On failure**: Note reason (e.g. "repos not accessible, git fetch failed"). Continue — the Culprit field will rely on Datadog/Cloudflare/PagerDuty data only.
