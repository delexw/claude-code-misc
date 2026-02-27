# CSS Inspection Patterns

JavaScript snippets for use with `mcp__chrome-devtools__evaluate_script` to debug CSS layout
issues in the browser.

## Element Dimensions

### Get bounding rect for a single element
```javascript
const el = document.querySelector('.target-selector');
const rect = el.getBoundingClientRect();
JSON.stringify({
  width: Math.round(rect.width),
  height: Math.round(rect.height),
  top: Math.round(rect.top),
  left: Math.round(rect.left),
  overflowsViewport: rect.width > window.innerWidth
})
```

### Get dimensions for all children of a container
```javascript
const parent = document.querySelector('.container-selector');
const children = Array.from(parent.children).map((child, i) => {
  const rect = child.getBoundingClientRect();
  return {
    index: i,
    tag: child.tagName,
    class: child.className.split(' ')[0],
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
});
JSON.stringify(children, null, 2)
```

## Computed Styles

### Get key layout properties
```javascript
const el = document.querySelector('.target-selector');
const s = window.getComputedStyle(el);
JSON.stringify({
  display: s.display,
  position: s.position,
  width: s.width,
  height: s.height,
  maxWidth: s.maxWidth,
  minWidth: s.minWidth,
  flexDirection: s.flexDirection,
  gridTemplateColumns: s.gridTemplateColumns,
  gridTemplateRows: s.gridTemplateRows,
  overflow: s.overflow,
  overflowX: s.overflowX,
  boxSizing: s.boxSizing
})
```

### Check container query context
```javascript
const el = document.querySelector('.target-selector');
const s = window.getComputedStyle(el);
JSON.stringify({
  containerType: s.containerType,
  containerName: s.containerName,
  contain: s.contain
})
```

## Container Query Debugging

### Find the nearest container ancestor
```javascript
function findContainer(selector) {
  let el = document.querySelector(selector);
  const chain = [];
  while (el && el !== document.body) {
    const ct = window.getComputedStyle(el).containerType;
    if (ct && ct !== 'normal') {
      const rect = el.getBoundingClientRect();
      chain.push({
        tag: el.tagName,
        class: el.className.split(' ').slice(0, 2).join(' '),
        containerType: ct,
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
    }
    el = el.parentElement;
  }
  return JSON.stringify(chain, null, 2);
}
findContainer('.target-selector')
```

### Check if a container query would match
```javascript
// For @container (inline-size < 700px), check the container's inline size
const container = document.querySelector('.container-selector');
const rect = container.getBoundingClientRect();
JSON.stringify({
  containerWidth: Math.round(rect.width),
  wouldMatchLessThan700: rect.width < 700,
  wouldMatchMaxWidth700: rect.width <= 700,
  explanation: rect.width === 700
    ? 'AT boundary: < 700 is FALSE, <= 700 is TRUE'
    : rect.width < 700
      ? 'BELOW boundary: both match'
      : 'ABOVE boundary: neither match'
})
```

## Overflow Detection

### Check for horizontal overflow on the page
```javascript
const overflowing = [];
document.querySelectorAll('*').forEach(el => {
  if (el.scrollWidth > el.clientWidth + 1) {
    const rect = el.getBoundingClientRect();
    overflowing.push({
      tag: el.tagName,
      class: el.className.split(' ').slice(0, 2).join(' '),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflow: el.scrollWidth - el.clientWidth,
      visible: rect.width > 0 && rect.height > 0
    });
  }
});
JSON.stringify(overflowing.filter(e => e.visible).slice(0, 10), null, 2)
```

### Check if body/html has horizontal scrollbar
```javascript
JSON.stringify({
  bodyScrollWidth: document.body.scrollWidth,
  viewportWidth: window.innerWidth,
  hasHorizontalScroll: document.body.scrollWidth > window.innerWidth,
  overflow: document.body.scrollWidth - window.innerWidth
})
```

## Grid and Flexbox Inspection

### Inspect grid layout
```javascript
const el = document.querySelector('.grid-selector');
const s = window.getComputedStyle(el);
const children = Array.from(el.children).map((child, i) => ({
  index: i,
  gridColumn: window.getComputedStyle(child).gridColumn,
  gridRow: window.getComputedStyle(child).gridRow,
  width: Math.round(child.getBoundingClientRect().width)
}));
JSON.stringify({
  display: s.display,
  gridTemplateColumns: s.gridTemplateColumns,
  gridTemplateRows: s.gridTemplateRows,
  gap: s.gap,
  children
}, null, 2)
```

### Inspect flex layout
```javascript
const el = document.querySelector('.flex-selector');
const s = window.getComputedStyle(el);
const children = Array.from(el.children).map((child, i) => {
  const cs = window.getComputedStyle(child);
  return {
    index: i,
    flexGrow: cs.flexGrow,
    flexShrink: cs.flexShrink,
    flexBasis: cs.flexBasis,
    width: Math.round(child.getBoundingClientRect().width)
  };
});
JSON.stringify({
  display: s.display,
  flexDirection: s.flexDirection,
  flexWrap: s.flexWrap,
  gap: s.gap,
  children
}, null, 2)
```

## Responsive Testing Utilities

### Compare element at multiple viewports (manual approach)
After emulating each viewport width, run:
```javascript
const selector = '.target-selector';
const el = document.querySelector(selector);
const rect = el.getBoundingClientRect();
const s = window.getComputedStyle(el);
JSON.stringify({
  viewport: window.innerWidth,
  element: {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    display: s.display,
    gridTemplateColumns: s.gridTemplateColumns
  },
  overflows: rect.width > window.innerWidth
})
```

Collect results from each viewport into a comparison table to identify where layout breaks.
