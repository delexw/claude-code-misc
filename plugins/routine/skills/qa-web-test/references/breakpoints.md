# Common Breakpoints Reference

## Common Responsive Breakpoints

| Name | Width | Use Case |
|------|-------|----------|
| Mobile S | 320px | Small phones |
| Mobile M | 375px | iPhone SE/standard |
| Mobile L | 425px | Large phones |
| Tablet | 768px | iPad portrait |
| Laptop | 1024px | Small desktops |
| Laptop L | 1440px | Large desktops |
| 4K | 2560px | Ultra-wide |

## Container Query vs Media Query Gotchas

### The Boundary Problem

When mixing container queries with media queries or other container queries, watch for
boundary mismatches:

```scss
// These two DO NOT match at the same width:
@container (max-width: 700px) { ... }     // Matches AT 700px (inclusive)
@container (inline-size < 700px) { ... }  // Does NOT match at 700px (exclusive)
```

**Real-world example**: A parent component uses a container query with strict less-than
(`@container (inline-size < 700px)`) to collapse columns. A child uses
`@container (max-width: 700px)` to make an image full-width. At exactly 700px:
- Parent keeps columns horizontal (700 < 700 = false)
- Child makes image full-width (700 <= 700 = true)
- Result: image overflows its column

**Fix**: Always use consistent container query syntax between parent and child components.

### Testing Strategy

For any breakpoint at value N, always test three widths:
1. **N-1**: Below the breakpoint
2. **N**: Exactly at the breakpoint (where bugs hide)
3. **N+1**: Above the breakpoint

This catches off-by-one errors that wouldn't be visible at wider or narrower test widths.

## Device Emulation Settings

When emulating viewports for accurate testing:

| Width Range | isMobile | hasTouch | deviceScaleFactor |
|-------------|----------|----------|-------------------|
| < 768px | true | true | 2 (retina) or 1 |
| 768-1024px | true/false | true/false | 1 or 2 |
| > 1024px | false | false | 1 |

Setting `isMobile: true` affects:
- CSS `hover` media query (becomes `hover: none`)
- Touch target sizing
- Scrollbar behavior
- Some CSS `pointer` media queries
