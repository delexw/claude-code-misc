# Step 3: Emulate and Capture

For each breakpoint width:

## 1. Emulate the viewport

Use `mcp__chrome-devtools__emulate` with:

- `width`: target width
- `height`: 900 (reasonable default)
- `deviceScaleFactor`: 1 (for clean screenshots)
- For mobile widths (<768px), set `isMobile: true` and `hasTouch: true`

Setting `isMobile: true` affects CSS media queries like `hover: none` and touch target sizing.

## 2. Wait for layout to settle

Evaluate a small delay or wait for a specific element using `mcp__chrome-devtools__wait_for`.

## 3. Take a screenshot

Use `mcp__chrome-devtools__take_screenshot` and save to the output directory with descriptive filenames:

```
$ARGUMENTS[1]/screenshots/<page>-<width>px.png
```

Ensure the directory exists first: `mkdir -p $ARGUMENTS[1]/screenshots`

Screenshots capture the visible viewport — scroll or use full-page capture for below-fold content.

## 4. Inspect element dimensions

If testing a specific layout bug, use `mcp__chrome-devtools__evaluate_script`:

```javascript
// Check element width to detect overflow
const el = document.querySelector('.target-selector');
const rect = el.getBoundingClientRect();
JSON.stringify({ width: rect.width, height: rect.height, overflow: rect.width > window.innerWidth })
```

## Tips

- **After navigation, re-emulate** — page loads may reset the viewport configuration
- **Container queries depend on parent width**, not viewport — inspect the container element's
  actual width, not just `window.innerWidth`
