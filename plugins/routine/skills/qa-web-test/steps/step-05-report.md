# Step 5: Report Results

After testing, save a report file to the output directory.

## Setup

1. Determine the output directory from `OUT_DIR` (default: `./qa-reports`)
2. Run `mkdir -p OUT_DIR/screenshots` to ensure directories exist
3. Generate a timestamp-based filename: `qa-report-{YYYY-MM-DD}.md`

## Report contents

The report file must include:

1. **URL tested** — the target page URL
2. **Date** — when the test was run
3. **Screenshot locations** — list all saved screenshot paths (relative to report)
4. **Pass/Fail per breakpoint** — whether layout looks correct at each width
5. **Specific findings** — any overflow, misalignment, or unexpected behavior
6. **Element dimensions** — if inspected, show width/height at each breakpoint
7. **Visual design** — typography, color/contrast, spacing, and visibility findings per breakpoint

## Report template

Write the following markdown to `OUT_DIR/qa-report-{YYYY-MM-DD}.md`:

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

[Detailed description of any layout issues found]

## Visual Design

### Typography
| Element | Font | Size | Weight | Line Height | Issue |
|---------|------|------|--------|-------------|-------|
| h1      | Inter | 48px | 700 | 1.2 | Does not scale on mobile |
| p       | Inter | 16px | 400 | 1.5 | OK |

### Color & Contrast
| Element | FG Color | BG Color | Contrast Ratio | WCAG AA | Issue |
|---------|----------|----------|----------------|---------|-------|
| .nav-link | #666 | #fff | 5.74:1 | PASS | — |
| .banner p | #999 | #f5f5f5 | 2.85:1 | FAIL | Insufficient contrast |

### Spacing
| Element | Viewport | Padding | Margin | Gap | Issue |
|---------|----------|---------|--------|-----|-------|
| .container | 1200px | 0 48px | 0 auto | — | OK |
| .container | 375px  | 0 48px | 0 auto | — | Padding too large for mobile |
| .card-grid | 1200px | — | — | 32px | OK |
| .card-grid | 375px  | — | — | 32px | Gap does not reduce on mobile |

### Visibility
| Element | Viewport | Display | Expected | Issue |
|---------|----------|---------|----------|-------|
| .mobile-nav | 375px | none | visible | Nav hidden on mobile |
| .desktop-sidebar | 375px | block | none | Should be hidden on mobile |
```

## Save screenshots

When taking screenshots during Step 3, save them to `OUT_DIR/screenshots/{page}-{width}px.png`.

## Final output

After writing the report, print the report file path so the user knows where to find it.
