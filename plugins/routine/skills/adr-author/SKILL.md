---
name: adr-author
description: Guide writing clear, enforceable Architectural Decision Records (ADRs) that work with AI-powered review systems and human teams alike. Use this skill whenever a user wants to create, improve, review, or learn about ADRs — including when they mention "architecture decision", "ADR", "document a decision", "tech decision record", or want to make an existing ADR more specific and enforceable. Also use when reviewing PRs that reference ADR compliance or when someone asks how to write decisions that automated tools can check.
allowed-tools: Read, Glob, Write, Edit
---

# ADR Authoring Guide

Help users write Architectural Decision Records that future developers actually
read and that automated review systems can enforce. Based on Michael Nygard's
format from [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## How to Think About ADRs

An ADR captures a decision at a moment in time. It answers: what did we decide,
why, and what happens because of it? The audience is a future developer (or an
AI reviewer) who encounters code that seems odd and needs to understand the
reasoning behind it.

The Decision section is the heart of an ADR — it's what gets enforced. The rest
(Context, Consequences) provides the reasoning that makes enforcement feel
reasonable rather than arbitrary. Spend most of your effort on the Decision
section, and write it at the enforceability level the team actually needs.

## Workflow

### Step 1: Read Existing ADRs

Before writing anything, find and read the project's existing ADRs. They're
typically in `docs/adr/`, `doc/arch/`, or `decisions/`. Look for:

- Numbering scheme (sequential integers, date-prefixed, etc.)
- Section structure (some teams add "Alternatives Considered" or "References")
- Tone and detail level
- Status conventions

Match what's already there. Consistency matters more than any template.

### Step 2: Understand the Decision

Ask the user (if not already clear from context):

1. **What's the decision?** What architectural choice is being made?
2. **What's the problem?** What forces or tensions led here?
3. **What alternatives were considered?** Even briefly — this goes in Context.
4. **How should this be enforced?** This determines enforceability level.

The fourth question is the key one this skill adds. Most ADR guides skip it,
but it determines whether the ADR becomes a living contract or shelf-ware.

### Step 3: Choose an Enforceability Level

Enforceability isn't about quality — a LOW enforceability ADR can be excellent.
It's about what kind of verification is possible and appropriate.

**HIGH** — Automated tools can check compliance. Use when there are concrete,
measurable requirements: file paths, numeric thresholds, version constraints,
exact formats. The Decision section needs 2+ specific, verifiable patterns.

**MEDIUM** — A human reviewer can check compliance with clear guidance. Use for
architectural patterns, prohibitions, and quality guidelines that require
judgment. The Decision section needs 1+ clear guideline with enough specificity
that two reviewers would agree on whether code complies.

**LOW** — Reference and context only. Use for principles, historical rationale,
and recommendations. No enforcement mechanism needed. These ADRs are valuable
for understanding *why* things are the way they are.

Ask the user which level they want. If they're unsure, help them choose based on
the nature of the decision: if you can write a linter rule or script to check
it, it's HIGH. If a reviewer can check it with a clear yes/no, it's MEDIUM. If
it's guidance that reasonable people might apply differently, it's LOW.

### Step 4: Draft the ADR

Use Michael Nygard's four sections. Write in full sentences and paragraphs —
ADRs are a conversation with future developers, not a requirements spec.

```markdown
# ADR [NUMBER]: [Short noun phrase]

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context

[Forces at play — technological, political, social, project-local.
Present tensions neutrally. Explain why a decision is needed now.]

## Decision

We will [decision in active voice].

[The enforceable substance goes here — see patterns below.]

## Consequences

[What becomes easier, what becomes harder, what new problems arise,
what trade-offs are we accepting. Be honest about downsides.]
```

**Formatting guidelines** (per Nygard):
- One to two pages total
- Full sentences in paragraphs, not just bullet lists
- Active voice in Decision ("We will..." not "It was decided...")
- Neutral tone in Context, save opinions for Decision
- Sequential numbering, never reused

### Step 5: Write the Decision Section for Your Target Level

This is where enforceability patterns matter. The Decision section is what
automated tools scan and what reviewers check against PRs.

#### Writing HIGH Enforceability Decisions

A HIGH decision reads like natural prose but contains specific, extractable
constraints. Think of it as embedding verifiable facts in readable writing.

**The six pattern types that enable automation:**

1. **File paths** — exact locations in backticks
   > All API routes will be in `src/api/v2/`. Components follow
   > `src/components/{feature}/{ComponentName}.tsx`.

2. **Measurable constraints** — numbers with units
   > Database queries will timeout after 30 seconds. Bundle sizes will not
   > exceed 250kb per page.

3. **Configuration values** — key:value or key=value pairs
   > HTTP clients will use `timeout: 5000`. The connection pool uses
   > `maxConnections = 10`.

4. **Version constraints** — specific version requirements
   > We will use Node.js >= 20.0.0. React dependency will be ^18.0.0.

5. **Format specifications** — exact structural patterns
   > Error responses follow: `{error: string, code: number, details?: object}`.
   > Commits use: `type(scope): description`.

6. **Declarative statements with specific objects** — "will use X for Y"
   > We will use TypeScript for all new files. Async operations will use
   > async/await instead of Promise chains.

Include at least 2 of these pattern types. Add concrete examples, state the
verification method (CI check, linter rule, code review checkpoint), and note
exceptions explicitly.

**Example HIGH Decision:**

```markdown
## Decision

We will standardize on Next.js App Router for all new pages.

All new routes will use the `app/` directory structure with files at
`app/{route}/page.tsx`. For example, product detail pages go in
`app/products/[id]/page.tsx`. Components will be Server Components by default —
only add `'use client'` when client-side interactivity is required (forms,
onClick handlers, browser APIs).

Bundle size increases will be limited to 10% per feature. Any use of 'use
client' must be justified in the PR description explaining why server rendering
is insufficient.

The existing `pages/` directory remains for maintenance. New features use `app/`
starting March 2024. Migration happens opportunistically during major updates.

Verification: CI checks that new routes are in `app/` not `pages/`. ESLint rule
flags `'use client'` files without a justification comment.
```

#### Writing MEDIUM Enforceability Decisions

A MEDIUM decision provides clear enough guidance that a reviewer can make a
yes/no judgment. The patterns are less about exact values and more about
unambiguous intent.

**The five pattern types for reviewer-checkable decisions:**

1. **Clear prohibitions** — what we won't do
   > We will not use class components for new React code. Custom authentication
   > is prohibited; use Auth0.

2. **Implementation requirements** — patterns to follow
   > All endpoints will enforce input validation. Services will use dependency
   > injection for instantiation.

3. **Quality/security guidelines** — standards with clear scope
   > Database queries will use parameterized queries; direct string
   > concatenation for SQL is prohibited. Security headers will be set on all
   > HTTP responses.

4. **Architectural patterns** — structural decisions
   > New services will follow microservices architecture, each owning its data
   > and exposing a REST API.

5. **Universal requirements** — "all X must Y" statements
   > All public functions will have unit tests. All API changes will update the
   > OpenAPI specification.

Include a review checklist so reviewers know exactly what to check.

**Example MEDIUM Decision:**

```markdown
## Decision

We will standardize error handling across all services.

All async operations will use try-catch blocks. Errors will be wrapped with
context using typed error classes (ValidationError, AuthenticationError,
ExternalServiceError) extending a base ApplicationError. User-facing errors
will not expose internal details — they follow the format:
{message: string, code: string, details?: object}.

All errors will be logged with correlation IDs for request tracing. Sensitive
data will be sanitized before logging.

Review checklist:
- Async operations have try-catch with context
- Appropriate error class is used
- User-facing errors are sanitized
- Errors are logged before handling/re-throwing
```

#### Writing LOW Enforceability Decisions

LOW decisions document rationale and principles. They're valuable for
understanding *why* without prescribing *how*.

```markdown
## Decision

We chose PostgreSQL over MongoDB for our primary datastore. Our data model is
heavily relational with complex joins across orders, inventory, and customer
records. PostgreSQL's ACID transactions and mature tooling ecosystem align with
our reliability requirements.

We considered MongoDB for its schema flexibility, which would benefit our
rapidly changing product catalog. However, the transactional integrity
requirements for financial data outweigh the flexibility benefits.

Future iterations may introduce a document store for the product catalog if
schema changes become a bottleneck.
```

### Step 6: Review and Refine

Check the draft against its target level:

**For HIGH** — Can you write a script or linter rule to verify each requirement?
If not, it's not HIGH yet. Look for vague language ("appropriate", "clean",
"good") and replace with specifics.

**For MEDIUM** — Would two independent reviewers agree on whether code complies?
If the requirement is ambiguous enough that reasonable people would disagree,
either make it more specific (upgrade to HIGH) or acknowledge it's guidance
(downgrade to LOW).

**For LOW** — Does it explain the *why* clearly enough that a developer five
years from now would understand the reasoning? That's the bar.

**Common refinement moves:**

Vague → Specific (LOW → HIGH):
```
Before: "Use good error handling"
After:  "All async functions will use try-catch with structured logging:
         {level: string, message: string, stack?: string}"
```

Abstract → Concrete (LOW → MEDIUM):
```
Before: "Consider security"
After:  "All user inputs will be validated against SQL injection and XSS
         using the sanitization library"
```

Over-rigid → Practical (HIGH → MEDIUM):
```
Before: "All components must be exactly 50 lines or less"
After:  "Components should stay under 100 lines; split when they handle
         multiple concerns"
```

### Step 7: Verify Consequences Are Honest

The Consequences section builds trust. If it only lists benefits, it reads like
a sales pitch and future developers won't trust it. Include:

- What becomes easier (the wins)
- What becomes harder (the costs)
- What new problems this might create (the risks)
- What trade-offs are being accepted (the conscious choices)

## Common Anti-Patterns

**Vague mandates**: "Must write clean code" → "Must pass ESLint rules in
`.eslintrc.js` with zero warnings"

**Unenforceable absolutes**: "All code must be perfect" → "All public functions
must have tests with >80% branch coverage"

**Technology without constraints**: "Use React for frontend" → "Use React >=
18.0.0 with TypeScript strict mode for new components"

**Missing examples**: "Follow proper naming" → "camelCase for functions
(`getUserData`), PascalCase for components (`UserProfile`), UPPER_SNAKE_CASE for
constants (`MAX_RETRY_COUNT`)"

**Mixed enforceability**: Don't combine "files must be in `src/`" (HIGH) with
"use good architecture" (LOW) in the same Decision section. Be consistent in
specificity, or split into separate numbered requirements at different levels.

## Reference Files

For comprehensive pattern catalogs and ready-to-use templates, read these when
you need more depth than this guide provides:

- `references/enforceability-patterns.md` — exhaustive catalog of all pattern
  types with examples in both natural prose and prescriptive styles, pattern
  recognition keywords, verification methods, and upgrade paths between levels.
  Read this when you need to identify specific patterns or help a user upgrade
  from one level to another.

- `references/templates.md` — copy-paste templates for HIGH, MEDIUM, and LOW
  enforceability ADRs, each with a complete worked example. Read this when the
  user wants a starting template to fill in.
