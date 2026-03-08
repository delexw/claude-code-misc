# Step 3: Build Dynamic Skill

Create a dynamic skill that will perform codebase analysis (conditional), synthesise PIRs, and save results. The skill references all discovery output files from Step 2 as lazy-loaded context.

## 3a: Create Skill Directory

Generate a short slug from the investigation query (e.g. `incidents-last-24h`, `errors-2026-03-01`), then append a short random string (4-6 alphanumeric chars) to ensure uniqueness (e.g. `incidents-last-24h-a3f2`).

```
SKILL_DIR=~/.claude/skills/pir-{slug}-report-{rand}
```

Create the directory:
```bash
mkdir -p "$SKILL_DIR"
```

## 3b: Copy Reference Files

Copy the PIR form fields reference into the skill directory so the dynamic skill can access it:

```bash
cp "${CLAUDE_SKILL_DIR}/.claude/skills/pir/references/pir-form-fields.md" "$SKILL_DIR/pir-form-fields.md"
```

If `${CLAUDE_SKILL_DIR}` is not available, fall back to `$HOME/.claude/skills/pir/references/pir-form-fields.md`.

Also copy all successful discovery reports into a `references/` subfolder so the dynamic skill can access them via `${CLAUDE_SKILL_DIR}`:

```bash
mkdir -p "$SKILL_DIR/references"
```

For each discovery source that succeeded, copy its report:
```bash
# Only copy reports that exist (i.e. the discovery source succeeded)
[ -f .pagerduty-oncall-tmp/report.md ] && cp .pagerduty-oncall-tmp/report.md "$SKILL_DIR/references/pagerduty-report.md"
[ -f .datadog-analyser-tmp/report.md ] && cp .datadog-analyser-tmp/report.md "$SKILL_DIR/references/datadog-report.md"
[ -f .cloudflare-traffic-investigator-tmp/report.md ] && cp .cloudflare-traffic-investigator-tmp/report.md "$SKILL_DIR/references/cloudflare-report.md"
[ -f .rollbar-reader-tmp/report.md ] && cp .rollbar-reader-tmp/report.md "$SKILL_DIR/references/rollbar-report.md"
```

## 3c: Save Discovery Summary

Write a `discovery-sources.md` file to `$SKILL_DIR/` summarising which discovery sources succeeded and their output file paths:

```markdown
# Discovery Sources

## PagerDuty
- Status: [Success / Skipped / Failed — reason]
- Report: references/pagerduty-report.md

## Datadog
- Status: [Success / Skipped / Failed — reason]
- Report: references/datadog-report.md

## Cloudflare
- Status: [Success / Skipped / Failed — reason]
- Report: references/cloudflare-report.md

## Rollbar
- Status: [Success / Skipped / Failed — reason]
- Report: references/rollbar-report.md
```

## 3d: Generate SKILL.md

Create `$SKILL_DIR/SKILL.md` using the **Write** tool. The content must include:

1. **Frontmatter** with `name: pir-{slug}-report-{rand}`, `allowed-tools: Read, Bash, Write`, `context: fork`, `model: opus`
2. **Arguments section** passing through `$ARGUMENTS[1]` (repos list) and the investigation query
3. **Discovery report paths** — instruct the agent to read each report file from `${CLAUDE_SKILL_DIR}/references/`
4. **Codebase analysis instructions** — conditional on repos list being provided. Include the full instructions from the old step 3 (git log/show on origin/main, correlate with issue timestamps, save to `.codebase-analysis-tmp/report.md`)
5. **Severity auto-classification table** — copied from the main SKILL.md
6. **PIR synthesis instructions** — how to correlate findings across sources, deduplicate issues, and fill each PIR field (What, Who, Culprit, When, etc.)
7. **Save and present instructions** — save each PIR to `.pir-tmp/PIR-YYYY-MM-DD-<short-slug>.md`, display summary table with data sources status, clean up all tmp folders, inform user of output directory

Use the following template structure:

```markdown
---
name: pir-{slug}-report-{rand}
description: "PIR report generation for: {investigation_query}"
allowed-tools: Read, Bash, Write
context: fork
model: sonnet
---

# PIR Report: {investigation_query}

## Discovery Reports

Read these reports from the skill directory (`${CLAUDE_SKILL_DIR}`). Each contains findings from a discovery source:

- **PagerDuty**: `${CLAUDE_SKILL_DIR}/references/pagerduty-report.md` [if status was Success]
- **Datadog**: `${CLAUDE_SKILL_DIR}/references/datadog-report.md` [if status was Success]
- **Cloudflare**: `${CLAUDE_SKILL_DIR}/references/cloudflare-report.md` [if status was Success]
- **Rollbar**: `${CLAUDE_SKILL_DIR}/references/rollbar-report.md` [if status was Success]

Read ALL available reports before proceeding. Check `${CLAUDE_SKILL_DIR}/discovery-sources.md` to see which sources succeeded.

## PIR Form Reference

Read `${CLAUDE_SKILL_DIR}/pir-form-fields.md` for the output template and field definitions.

## Phase 1: Codebase Analysis (conditional)

[Include ONLY if repos list was provided]

Repos to investigate: {repos_list}

[Include full codebase analysis instructions: git fetch, git log origin/main, git show origin/main:<file>, correlation with discovery findings, save to .codebase-analysis-tmp/report.md]

IMPORTANT: Do NOT checkout main. Use `git log origin/main` and `git show origin/main:<file>` only.

## Phase 2: Synthesise PIR for Each Issue

[Include full synthesis instructions: correlate across sources, deduplicate, fill all PIR fields]

### Severity Auto-Classification

| Severity | Criteria |
|----------|----------|
| **SEV1** | Service outage or >50% error rate on critical path; cascading failures; >30 min duration |
| **SEV2** | Partial degradation; 10-50% error rate; single service affected; 10-30 min duration |
| **SEV3** | Minor impact; <10% error rate; brief spike (<10 min); limited user impact |

Use the highest applicable severity when multiple criteria match.

## Phase 3: Save and Present

Save each PIR as `.pir-tmp/PIR-YYYY-MM-DD-<short-slug>.md` following the output template.

Display a summary table with severity and incident title for each PIR.

Include data sources status section.

Clean up all temporary report folders:
```bash
rm -rf .pagerduty-oncall-tmp .datadog-analyser-tmp .cloudflare-traffic-investigator-tmp .rollbar-reader-tmp .codebase-analysis-tmp
```

Inform the user of the output directory: `.pir-tmp/`

Ask the user to review. Offer to adjust any field or regenerate individual PIRs.
```

**Important**: Inline the actual detailed instructions for codebase analysis, synthesis, and save/present into the SKILL.md — do not reference external step files. The dynamic skill must be self-contained.
