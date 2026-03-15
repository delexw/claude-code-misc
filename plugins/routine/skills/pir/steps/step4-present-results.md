# Step 4: Clean Up and Present Results

After Step 3 completes, the NotebookLM notebook contains the generated report and infographic.

## 4a: Clean Up

Clean up all temporary discovery report folders in current working directory to each folder name:

```
.pagerduty-oncall-tmp
.datadog-analyser-tmp
.cloudflare-traffic-investigator-tmp
.rollbar-reader-tmp
.codebase-analysis-tmp
```

For example, if the working directory is `/Users/me/project`, run: `rm -rf /Users/me/project/.pagerduty-oncall-tmp ...`

## 4b: Present Results

Provide the NotebookLM notebook link so the user can view the report, infographic, and explore the sources interactively.

Display a summary to the user:
- Number of distinct incidents found
- Severity classification for each
- Brief impact summary for each
- Notebook link for full report and infographic

Inform the user:
- Report and infographic are available in the NotebookLM notebook
- Notebook preserved for further exploration (e.g. query, generate podcast, slides, etc.)
- Ask if they want to adjust any field or regenerate
