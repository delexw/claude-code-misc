# Step 2: Determine Test Breakpoints

Choose breakpoints based on context:

- If the user specifies exact widths, use those
- If testing a specific CSS fix, test at the boundary values (e.g., for a 700px breakpoint:
  test at 699px, 700px, and 701px)
- Default responsive breakpoints for general testing: 375px, 768px, 1024px, 1440px

See [../references/breakpoints.md](../references/breakpoints.md) for common breakpoint values and
container query gotchas.

## Boundary Testing

A common source of CSS bugs is **off-by-one at breakpoint boundaries**. When testing a
breakpoint at width `N`:

- `@media (min-width: Npx)` activates at exactly N (inclusive)
- `@media (max-width: Npx)` activates at exactly N (inclusive)
- `@container (inline-size < Npx)` does NOT activate at exactly N (strict less-than)
- `@container (max-width: Npx)` activates at exactly N (inclusive)

This mismatch between container query syntaxes is a frequent source of bugs. Always test at
exactly the breakpoint value, not just above/below.

For any breakpoint at value N, always test three widths:
1. **N-1**: Below the breakpoint
2. **N**: Exactly at the breakpoint (where bugs hide)
3. **N+1**: Above the breakpoint
