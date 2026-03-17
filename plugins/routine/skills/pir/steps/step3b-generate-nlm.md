# Step 3b: Generate PIR via NotebookLM

Spawn a subagent with `Agent` tool to invoke `Skill("nlm-skill")` with the following instructions:

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
8. **Query the notebook for a short and funny poem** inspired by the incidents and findings, and save it as a note in the notebook
9. **Return the notebook ID** so Step 4 can reference it
