# Step 4b: Visual Design Inspection

After layout inspection, evaluate JavaScript at each breakpoint to check typography, color, spacing, and visibility.

## 1. Typography

```javascript
const selectors = ['h1','h2','h3','p','a','button','.nav-link','.card-title'];
const results = selectors.flatMap(sel => {
  const els = document.querySelectorAll(sel);
  if (!els.length) return [];
  const el = els[0];
  const s = window.getComputedStyle(el);
  return [{
    selector: sel,
    fontFamily: s.fontFamily.split(',')[0].trim(),
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textTransform: s.textTransform,
    color: s.color
  }];
});
JSON.stringify(results, null, 2)
```

Look for:
- Font sizes that don't scale down on mobile (e.g. 48px heading on 320px viewport)
- Inconsistent font families or weights across similar elements
- Line heights that are too tight (`< 1.2`) or too loose (`> 2.0`)

## 2. Color & Contrast

```javascript
const selectors = ['h1','h2','p','a','button','.nav-link','[class*="card"]','[class*="banner"]'];
const results = selectors.flatMap(sel => {
  const el = document.querySelector(sel);
  if (!el) return [];
  const s = window.getComputedStyle(el);
  return [{
    selector: sel,
    color: s.color,
    backgroundColor: s.backgroundColor,
    borderColor: s.borderColor !== s.color ? s.borderColor : undefined
  }];
});
JSON.stringify(results, null, 2)
```

For WCAG contrast ratio checking:

```javascript
function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
function parseRgb(str) {
  const m = str.match(/\d+/g);
  return m ? m.slice(0, 3).map(Number) : null;
}
function contrastRatio(fg, bg) {
  const l1 = luminance(...fg), l2 = luminance(...bg);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
}
const el = document.querySelector('.target-selector');
const s = window.getComputedStyle(el);
const fg = parseRgb(s.color), bg = parseRgb(s.backgroundColor);
const ratio = (fg && bg) ? contrastRatio(fg, bg) : 'N/A';
JSON.stringify({
  color: s.color,
  backgroundColor: s.backgroundColor,
  contrastRatio: ratio,
  passesAA: ratio >= 4.5,
  passesAALarge: ratio >= 3.0,
  passesAAA: ratio >= 7.0
})
```

WCAG thresholds:
- **AA normal text**: >= 4.5:1
- **AA large text** (>=18px bold or >=24px): >= 3.0:1
- **AAA normal text**: >= 7.0:1

## 3. Spacing

```javascript
const selectors = ['.container','main','section','[class*="card"]','[class*="grid"]','[class*="flex"]','header','footer','nav'];
const results = selectors.flatMap(sel => {
  const el = document.querySelector(sel);
  if (!el) return [];
  const s = window.getComputedStyle(el);
  return [{
    selector: sel,
    margin: s.margin,
    padding: s.padding,
    gap: s.gap,
    marginTop: s.marginTop,
    marginBottom: s.marginBottom,
    paddingLeft: s.paddingLeft,
    paddingRight: s.paddingRight
  }];
});
JSON.stringify(results, null, 2)
```

Look for:
- Padding that disappears on smaller viewports (content touching edges)
- Inconsistent spacing between similar sections
- Gap values that don't reduce on mobile (e.g. `gap: 48px` on 320px viewport)

## 4. Borders, Shadows & Decorations

```javascript
const selectors = ['[class*="card"]','button','.btn','input','[class*="modal"]','[class*="dropdown"]'];
const results = selectors.flatMap(sel => {
  const el = document.querySelector(sel);
  if (!el) return [];
  const s = window.getComputedStyle(el);
  return [{
    selector: sel,
    borderRadius: s.borderRadius,
    borderWidth: s.borderWidth,
    borderStyle: s.borderStyle,
    borderColor: s.borderColor,
    boxShadow: s.boxShadow,
    outline: s.outline
  }];
});
JSON.stringify(results, null, 2)
```

## 5. Visibility & Display State

Check for elements incorrectly hidden or shown at the current breakpoint:

```javascript
const selectors = ['nav','.sidebar','.menu','.modal','.drawer','[class*="mobile"]','[class*="desktop"]','[class*="hidden"]'];
const results = selectors.flatMap(sel => {
  const els = document.querySelectorAll(sel);
  return Array.from(els).slice(0, 3).map(el => {
    const s = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      selector: sel,
      class: el.className.split(' ').slice(0, 3).join(' '),
      display: s.display,
      visibility: s.visibility,
      opacity: s.opacity,
      hasSize: rect.width > 0 && rect.height > 0,
      isEffectivelyHidden: s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0'
    };
  });
});
JSON.stringify(results, null, 2)
```

Look for:
- Mobile nav still hidden at mobile breakpoints
- Desktop-only elements visible on mobile
- Elements with `opacity: 0` that should be visible

## Tips

- **Run these checks at each breakpoint** — visual properties often change across breakpoints via media/container queries
- **Compare results across viewports** — collect typography/spacing data at each width and look for inconsistencies
- **Adapt selectors** — the selectors above are common patterns; adjust to match the actual page structure discovered during Step 3
