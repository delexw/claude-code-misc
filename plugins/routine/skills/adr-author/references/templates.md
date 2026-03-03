# ADR Templates

Ready-to-use templates for each enforceability level. Copy the one that matches
your target level and fill in the bracketed sections. Each template includes a
complete worked example.

## Table of Contents

- [HIGH Enforceability Template](#high-enforceability-template)
- [MEDIUM Enforceability Template](#medium-enforceability-template)
- [LOW Enforceability Template](#low-enforceability-template)

---

## HIGH Enforceability Template

Use when you need automated + manual enforcement with specific, measurable
requirements. Include 2+ verifiable patterns in the Decision section.

```markdown
# ADR [NUMBER]: [Short noun phrase]

Date: YYYY-MM-DD

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context

[Describe forces at play in full paragraphs. Present tensions neutrally.
Explain the current situation, what constraints exist, and why a decision is
needed now. One to three paragraphs.]

## Decision

We will [specific decision in active voice].

[Paragraph explaining the core decision and its scope. When does it apply?
What's included and excluded?]

[Specific requirements — at least 2 of: file paths, measurable constraints,
configuration values, version requirements, format specs, or declarative
statements with specific objects. Write as natural prose with inline examples.]

[Verification approach: how compliance will be checked — CI rules, linter
config, review checkpoints, metrics to track.]

[Exceptions: any valid deviations, with rationale and approval process.]

[Timeline: when this takes effect, migration approach for existing code.]

## Consequences

[What becomes easier — concrete benefits in full sentences.]

[What becomes harder — honest costs and trade-offs.]

[New problems this may create — risks to monitor.]

[Trade-offs being accepted — what we chose and why.]
```

### Worked Example: React Component File Structure

```markdown
# ADR 23: Standardize React Component File Structure

Date: 2024-03-01

## Status

Accepted

## Context

Our React codebase has grown to 150+ components across five teams with no
consistent organization. Some teams use feature directories, others flat
structure, and test files are scattered. New developers spend ~30 minutes
finding related files during bug fixes. Import paths are unpredictable,
breaking automated refactoring tools.

The team has debated this for six months. Engineering wants co-location for
maintainability. Product is concerned about migration effort on the Q2 roadmap.
Three new developers struggling to navigate the codebase made this urgent.

## Decision

We will enforce a standardized component structure based on feature
organization with co-located files.

All components will be in `src/components/{feature}/{ComponentName}/` where
feature is the domain area (auth, profile, dashboard). The login form goes in
`src/components/auth/LoginForm/`. File naming follows
`{ComponentName}.{type}.{ext}` — tsx for implementation, test.tsx for tests,
module.css for styles, types.ts for type definitions.

Every component directory includes an index.ts re-exporting the component:
`export { ComponentName } from './ComponentName'`. This enables clean imports
like `import { LoginForm } from 'components/auth/LoginForm'`.

ESLint rules in CI check that file paths match the pattern and index files
exist. Code reviews verify new components follow the structure. Target: 80%
compliance by June 2024, 100% for new code immediately.

New components follow this structure starting March 1, 2024. Existing
components migrate opportunistically during feature work — no bulk migration.
Thin third-party wrappers may keep their current location.

## Consequences

Finding related files becomes trivial — tests are always co-located with
predictable names. IDE "go to test" features work reliably. Import paths are
consistent, enabling automated refactoring. Code reviews focus on logic instead
of debating file placement.

Migration requires ~40 hours across 150 components over three months.
Developers need to learn the new structure. Dual import paths during migration
add temporary complexity. Deeper nesting means longer file paths, which may
annoy Windows developers near the 260-char limit.

We're choosing long-term consistency over short-term flexibility, accepting
three months of reduced velocity for years of improved maintainability.
```

---

## MEDIUM Enforceability Template

Use when you need clear guidelines that a reviewer can check with yes/no
judgment. Include 1+ clear requirement with enough specificity that two
reviewers would agree.

```markdown
# ADR [NUMBER]: [Short noun phrase]

Date: YYYY-MM-DD

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context

[Background in full paragraphs. What problem exists, what tensions led here.]

## Decision

We will [decision in active voice].

[Core approach and rationale in paragraph form.]

[Implementation guidelines — clear requirements that need human judgment.
Explain what to do, when it applies, and why it matters.]

[Application scenarios: when to apply, when to deviate, how to verify.]

Review checklist:
- [ ] [Checkpoint a reviewer should check]
- [ ] [Another checkpoint]
- [ ] [Another checkpoint]

## Consequences

[Benefits, costs, risks, and trade-offs in full sentences.]
```

### Worked Example: Error Handling Pattern

```markdown
# ADR 15: Standardize Error Handling

Date: 2024-02-15

## Status

Accepted

## Context

Error handling is inconsistent across services. Some functions swallow errors
silently, others throw generic messages, and log formats vary. Debugging
production issues takes 3x longer than necessary because error context is
lost. Users see unhelpful "Something went wrong" messages.

## Decision

We will standardize on a consistent error handling pattern across all services.

All async operations will use try-catch blocks. Errors will be wrapped with
context using typed error classes — ValidationError, AuthenticationError,
ExternalServiceError — all extending ApplicationError. Each error includes
message, code, details, and originalError properties.

User-facing errors will not expose internal details (stack traces, database
errors). They follow: {message: string, code: string, details?: object}. Error
messages provide actionable guidance when possible.

All errors will be logged with appropriate level (error/warn), user context
(user ID, action), sanitized sensitive data, and correlation IDs for tracing.

This applies to all new service functions. Validation in pure functions can
throw directly (caught by service layer). Test utilities can fail fast.

Review checklist:
- [ ] Async operations have try-catch with context
- [ ] Appropriate error class used
- [ ] User-facing errors sanitized
- [ ] Errors logged before handling/re-throwing
- [ ] Correlation ID included in logs

## Consequences

Consistent errors improve debugging and reduce production investigation time.
Silent failures become visible. Users get helpful messages. Monitoring and
alerting become straightforward with structured error data.

More boilerplate per function. Team needs to learn the error class hierarchy.
~80 existing functions need updating. Error code documentation needed.
```

---

## LOW Enforceability Template

Use for principles, historical context, and recommendations. No enforcement
mechanism — the value is in explaining *why*.

```markdown
# ADR [NUMBER]: [Short noun phrase]

Date: YYYY-MM-DD

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context

[Background and the situation that prompted this decision.]

## Decision

We [chose/will follow/adopted] [approach] based on [reasoning].

[Explain the rationale, alternatives considered, and why this direction was
chosen. This is about understanding, not enforcement.]

[Recommendations for future work, if any.]

## Consequences

[What this means for the project going forward. What future developers should
know about this choice and its implications.]
```

### Worked Example: Database Selection

```markdown
# ADR 8: Use PostgreSQL as Primary Datastore

Date: 2024-01-10

## Status

Accepted

## Context

We're launching a new e-commerce platform and need to choose a primary
database. The data model involves orders, inventory, and customer records with
complex relationships. Financial transactions require ACID guarantees. The team
has strong PostgreSQL experience but limited MongoDB knowledge.

## Decision

We chose PostgreSQL over MongoDB for our primary datastore. Our data model is
heavily relational — orders reference customers, inventory, and shipping
records with complex joins. PostgreSQL's ACID transactions provide the
integrity guarantees our financial data requires.

We considered MongoDB for its schema flexibility, which would benefit the
rapidly changing product catalog. However, transaction integrity for payment
processing outweighs catalog flexibility. The team's existing PostgreSQL
expertise also reduces onboarding time and operational risk.

Future iterations may introduce a document store for the product catalog if
schema changes become a significant bottleneck, but we'll cross that bridge
when we reach it.

## Consequences

Relational modeling aligns naturally with our domain. Mature tooling (pgAdmin,
pg_dump, extensions) reduces operational burden. The team can be productive
immediately without learning a new database.

Schema migrations are required for model changes, adding process overhead.
Horizontal scaling is more complex than MongoDB's sharding model. If the
product catalog evolves rapidly, we may eventually need a polyglot persistence
approach.
```
