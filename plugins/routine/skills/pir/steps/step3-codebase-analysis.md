# Step 3: Codebase Analysis — Root Cause Investigation

**Condition**: Only run this step if `$ARGUMENTS[1]` (repos list) is provided.

Investigate recent commits that may have caused or contributed to the issues discovered in Step 2:

**PagerDuty Incidents**: [list incident titles, services, and timestamps from Step 2a]

**Datadog Abnormalities**: [list abnormal monitors, error spikes, SLO breaches, and degraded services from Step 2b]

**Cloudflare Traffic Anomalies**: [list traffic spikes, affected endpoints, and anomalous patterns from Step 2c]

**Rollbar Errors**: [list active error items, stack traces, affected services, and error-deploy correlations from Step 2d]

**Repos to investigate**: $ARGUMENTS[1]

For each repo, run:
- `git fetch origin main` to ensure origin/main is up to date
- `git log origin/main --since="<earliest_issue_start minus 24h>" --until="<latest_issue_end>" --oneline` to find recent commits near the issue window
- `git show origin/main:<file>` to read relevant source code when a suspicious commit is found

**IMPORTANT**: Do NOT checkout main. Use `git log origin/main` and `git show origin/main:<file>` only.

Correlate issue timestamps with recent deploys and code changes to identify culprit commits. Look for:
- Config changes, feature flag toggles, or environment variable updates
- Changes to error handling, retry logic, or timeouts
- Database migration or schema changes
- Dependency version bumps
- Changes to the specific services or endpoints mentioned in the incidents, Datadog monitors, Cloudflare traffic anomalies, or Rollbar error items

Read relevant source code from origin/main to provide constructive cause analysis with specific file and code references.

Save the full analysis to `.codebase-analysis-tmp/report.md` with this structure:
- **Repo**: repo name
- **Suspicious commits**: hash, author, date, message
- **Code references**: file paths and relevant code snippets
- **Correlation**: how the change relates to the issue timeline and symptoms (reference whether it correlates with a PagerDuty incident, Datadog anomaly, Cloudflare traffic pattern, Rollbar error, or multiple)
- **Confidence**: High / Medium / Low

**Extract from report** (`.codebase-analysis-tmp/report.md`):
- Suspicious commits near issue timestamps → **Culprit**
- Code changes that explain observed failures, anomalies, or traffic patterns → **What**, **Culprit**
- Deploy timestamps that correlate with issue start → **When**
- Specific file and code references → **Culprit** detail

**On failure**: Note reason (e.g. "repos not accessible, git fetch failed"). Continue — the Culprit field will rely on Datadog/Cloudflare/Rollbar/PagerDuty data only.
