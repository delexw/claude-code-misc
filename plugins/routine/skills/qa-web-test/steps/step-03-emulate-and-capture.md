# Step 3: Emulate and Capture

For each breakpoint width:

## 1. Resize the viewport

Evaluate `window.resizeTo(WIDTH, 900)` to resize the browser window.

## 2. Wait for layout to settle

Evaluate a short delay (`new Promise(r => setTimeout(r, 500))`) for reflow.

## 3. Take a screenshot

Save to `OUT_DIR/screenshots/page-WIDTHpx.png`.

Ensure the directory exists first: `mkdir -p OUT_DIR/screenshots`

## 4. Inspect element dimensions

If testing a specific layout bug, evaluate JavaScript that checks element bounding rects and overflow:

```javascript
const el = document.querySelector('.target-selector');
const rect = el.getBoundingClientRect();
JSON.stringify({ width: rect.width, height: rect.height, overflow: rect.width > window.innerWidth })
```

## Tips

- **After navigation, re-resize** — page loads may reset the viewport configuration
- **Container queries depend on parent width**, not viewport — inspect the container element's
  actual width, not just `window.innerWidth`
- Re-snapshot after resize if you need to interact with elements at the new viewport
