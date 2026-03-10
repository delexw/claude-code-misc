# Step 4: Present Results and Clean Up

After Step 3 completes, the NotebookLM notebook contains the generated report and infographic.

## 4a: Present Results

Provide the NotebookLM notebook link so the user can view the report, infographic, and explore the sources interactively.

Display a summary to the user:
- Number of distinct incidents found
- Severity classification for each
- Brief impact summary for each
- Notebook link for full report and infographic

## 4b: Clean Up

Clean up all temporary discovery report folders:

```bash
rm -rf .pagerduty-oncall-tmp .datadog-analyser-tmp .cloudflare-traffic-investigator-tmp .rollbar-reader-tmp .codebase-analysis-tmp
```

Do NOT delete the NotebookLM notebook — the user may want to query it further or generate additional artifacts.

Inform the user:
- Report and infographic are available in the NotebookLM notebook
- Notebook preserved for further exploration (e.g. query, generate podcast, slides, etc.)
- Ask if they want to adjust any field or regenerate
