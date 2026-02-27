# Step 4: CSS Property Inspection

When debugging a specific CSS issue, use `mcp__chrome-devtools__evaluate_script` to inspect
computed styles.

## Get computed CSS properties

```javascript
const el = document.querySelector('.target-selector');
const styles = window.getComputedStyle(el);
JSON.stringify({
  display: styles.display,
  width: styles.width,
  gridTemplateColumns: styles.gridTemplateColumns,
  containerType: styles.containerType,
  overflow: styles.overflow
})
```

## Find nearest container ancestor

For container query debugging, walk up the DOM to find the container:

```javascript
let el = document.querySelector('.target-selector');
while (el && el !== document.body) {
  const ct = window.getComputedStyle(el).containerType;
  if (ct && ct !== 'normal') {
    const rect = el.getBoundingClientRect();
    return JSON.stringify({
      tag: el.tagName,
      class: el.className,
      containerType: ct,
      width: rect.width
    });
  }
  el = el.parentElement;
}
'No container found'
```

See [../references/css-inspection.md](../references/css-inspection.md) for more inspection patterns
including overflow detection, grid/flex inspection, and multi-element comparison.
