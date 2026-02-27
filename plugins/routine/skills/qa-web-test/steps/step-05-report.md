# Step 5: Report Results

After testing, save a report file to the output directory.

## Setup

1. Determine the output directory from `$ARGUMENTS[1]` (default: `./qa-reports`)
2. Run `mkdir -p $ARGUMENTS[1]/screenshots` to ensure directories exist
3. Generate a timestamp-based filename: `qa-report-{YYYY-MM-DD}.md`

## Report contents

The report file must include:

1. **URL tested** — the target page URL
2. **Date** — when the test was run
3. **Screenshot locations** — list all saved screenshot paths (relative to report)
4. **Pass/Fail per breakpoint** — whether layout looks correct at each width
5. **Specific findings** — any overflow, misalignment, or unexpected behavior
6. **Element dimensions** — if inspected, show width/height at each breakpoint

## Report template

Write the following markdown to `$ARGUMENTS[1]/qa-report-{YYYY-MM-DD}.md`:

```markdown
# QA Test Results: [Page Name]

- **URL**: [tested URL]
- **Date**: [YYYY-MM-DD]
- **Output directory**: [path]

## Results

| Viewport | Status | Notes |
|----------|--------|-------|
| 699px    | PASS   | Columns collapsed, image fits container |
| 700px    | FAIL   | Image overflows - width 1196px > viewport 700px |
| 701px    | PASS   | Columns horizontal, image 120px fixed width |

## Screenshots

- `screenshots/page-699px.png`
- `screenshots/page-700px.png`
- `screenshots/page-701px.png`

## Findings

[Detailed description of any issues found]
```

## Save screenshots

When taking screenshots during Step 3, save them to `$ARGUMENTS[1]/screenshots/{page}-{width}px.png` instead of `/tmp/`.

## Final output

After writing the report, print the report file path so the user knows where to find it.
