# Step 3: Generate PIR via NotebookLM

Use the `nlm-skill` to create a NotebookLM notebook from the discovery reports, then generate a report, infographic, and slide deck.

## 3a: Check nlm-skill Availability

Run `/skills` to check if `nlm-skill` is installed. If it is NOT listed, **stop and inform the user**: "The `nlm-skill` is required for PIR report generation but is not installed. Please install it first."

## 3b: Conditional Codebase Analysis

If `$ARGUMENTS[1]` (repos list) was provided, perform codebase analysis before generating:

For each repo in the comma-separated list:
1. `cd` into the repo directory
2. Run `git fetch origin` to get latest refs
3. Run `git log origin/main --oneline --since="<incident_start>" --until="<incident_end>"` to find relevant commits
4. For suspicious commits, run `git show origin/main:<file>` to examine changes
5. Correlate commit timestamps with incident timeline from discovery reports

**IMPORTANT**: Do NOT checkout main. Use `git log origin/main` and `git show origin/main:<file>` only.

Save the codebase analysis to `.codebase-analysis-tmp/report.md`.

The analysis must produce a **definitive** conclusion — either:
- **"Culprit found: [description] — [evidence]"** when the root cause is confirmed, OR
- **"No culprit identified from codebase analysis"** when no causal link can be confirmed.

NEVER use hedging language.

## 3c: Invoke nlm-skill

Invoke `Skill("nlm-skill")` with the following instructions:

1. **Create a notebook** named `"PIR: {investigation_query} — {today's date}"`
2. **Upload all discovery reports** that exist as text sources to the notebook:
   - `.pagerduty-oncall-tmp/report.md` → title "PagerDuty Discovery Report"
   - `.datadog-analyser-tmp/report.md` → title "Datadog Discovery Report"
   - `.cloudflare-traffic-investigator-tmp/report.md` → title "Cloudflare Discovery Report"
   - `.rollbar-reader-tmp/report.md` → title "Rollbar Discovery Report"
   - `.codebase-analysis-tmp/report.md` → title "Codebase Root Cause Analysis" (if exists)
3. **Upload the PIR form fields reference** as a text source (read from `${CLAUDE_SKILL_DIR}/references/pir-form-fields.md`, falling back to `~/.claude/skills/pir/references/pir-form-fields.md`)
4. **Upload a synthesis guide** as a text source with this content:

   ```
   ## Severity Auto-Classification

   | Severity | Criteria |
   |----------|----------|
   | SEV1 | Service outage or >50% error rate on critical path; cascading failures; >30 min duration |
   | SEV2 | Partial degradation; 10-50% error rate; single service affected; 10-30 min duration |
   | SEV3 | Minor impact; <10% error rate; brief spike (<10 min); limited user impact |

   Use the highest applicable severity when multiple criteria match.

   ## Instructions
   Cross-correlate findings from all discovery sources. For each distinct issue:
   - Identify the issue from the strongest signal
   - Correlate supporting evidence from other sources
   - Determine severity using the table above
   - Fill all PIR fields per the PIR Form Fields Reference
   - Include a detailed incident timeline with timestamps from all sources
   - Culprit must be a definitive statement — no hedging language
   ```

5. **Generate a report** using the "Create Your Own" format with a custom prompt requesting a structured PIR with incident timeline, severity classification, and evidence sources
6. **Generate an infographic** (landscape, detailed, professional style)
7. **Generate a slide deck** summarizing the incident (timeline, root cause, affected services, severity, remediation steps) for team review and presentation
8. **Return the notebook ID** so Step 4 can reference it
