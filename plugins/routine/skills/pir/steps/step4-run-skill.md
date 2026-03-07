# Step 4: Run Dynamic Skill

Invoke the dynamic skill created in Step 3:

```
Skill("pir-{slug}-report")
```

The skill has all context (discovery reports, PIR form fields, codebase analysis instructions, synthesis rules) as lazy-loaded reference files. It will:

1. Read all discovery reports
2. Conditionally run codebase analysis (if repos were provided)
3. Synthesise PIRs for each distinct issue
4. Save PIR files and present results
5. Clean up temporary folders

Do NOT delete other skill directories.
