# Step 4: Run Dynamic Skill

Invoke the dynamic skill created in Step 3:

```
Skill("pir-{slug}-report-{rand}")
```

The skill has all context (discovery reports, PIR form fields, codebase analysis instructions, synthesis rules) as lazy-loaded reference files. It will:

1. Read all discovery reports
2. Conditionally run codebase analysis (if repos were provided)
3. Synthesise PIRs for each distinct issue
4. Save PIR files and present results
5. Clean up temporary discovery folders (`.pagerduty-oncall-tmp`, `.datadog-analyser-tmp`, `.cloudflare-traffic-investigator-tmp`, `.rollbar-reader-tmp`, `.codebase-analysis-tmp`)

Do NOT delete the dynamic skill directory (`~/.claude/skills/pir-{slug}-report-{rand}/`) or other skill directories.
