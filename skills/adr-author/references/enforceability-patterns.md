# Enforceability Patterns Catalog

Comprehensive reference for patterns that enable ADR enforcement. Read this when
you need to identify patterns in an existing ADR, help a user upgrade between
levels, or want verification method details.

Based on [Michael Nygard's ADR format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).
Write patterns in natural prose — automated tools extract patterns from both
conversational paragraphs and prescriptive bullets equally well.

## Table of Contents

- [HIGH Patterns](#high-enforceability-patterns) (automated verification)
- [MEDIUM Patterns](#medium-enforceability-patterns) (reviewer verification)
- [LOW Patterns](#low-enforceability-patterns) (reference only)
- [Upgrading Between Levels](#upgrading-between-levels)
- [Anti-Patterns](#anti-patterns)
- [Quick Reference](#quick-reference)

---

## HIGH Enforceability Patterns

Require 2+ of these for HIGH classification. Each is verifiable by script,
linter, or CI check.

### 1. File Path Specifications

**Recognition**: Paths in backticks, quotes, or standard path format.

```markdown
We will locate all API routes in `src/api/v2/`. This applies to endpoints
created after March 2024, with existing v1 endpoints remaining until
deprecation in Q4.

Components follow `src/components/{feature}/{ComponentName}.tsx` where feature
is the domain area (auth, profile, dashboard). The login form goes in
`src/components/auth/LoginForm/`.

Tests are co-located: ComponentName.tsx has ComponentName.test.tsx in the same
directory. Co-location makes tests easier to find and encourages writing them
during development.
```

**Verify**: `find src -type f -name "*.tsx" ! -path "src/components/*/*"`

### 2. Measurable Constraints

**Recognition**: Numbers with units (time, size, count, percentage).

```markdown
Database queries will timeout after 30 seconds. This prevents long-running
operations from blocking the application.

API responses will complete within 2 seconds under normal load, measured at the
95th percentile. Responses exceeding this trigger performance alerts.

Bundle sizes will not exceed 250kb per page. Each route's JavaScript bundle is
measured separately; pages exceeding this require optimization before deployment.

Failed operations retry a maximum of 3 times with exponential backoff (1s, 2s,
4s). After 3 failures, the operation throws to the caller.
```

**Verify**: `jest --coverage --coverageThreshold='{"global":{"branches":80}}'`

### 3. Configuration Parameters

**Recognition**: key:value or key=value patterns.

```markdown
All HTTP clients will use timeout: 5000 (5 seconds) to prevent hanging on
unresponsive services.

The database connection pool uses maxConnections = 10 to balance throughput with
resource usage. Monitor pool exhaustion metrics to adjust.

Environment variables follow UPPER_SNAKE_CASE format (e.g., ENABLE_NEW_CHECKOUT,
USE_REDIS_CACHE). Document all variables in the README.
```

**Verify**: `assert(config.timeout === 5000)` or check config files directly.

### 4. Version Constraints

**Recognition**: Version comparisons, minimum/maximum specifications.

```markdown
We will use Node.js >= 20.0.0 for all deployments. Version 20 provides native
fetch and improved performance. Local environments should match production.

React dependency will be ^18.0.0 for concurrent rendering and automatic
batching. The caret allows minor/patch updates but prevents breaking changes.

PostgreSQL 15 or higher is required. Version 15 introduces JSON handling and
query improvements we depend on. Older versions are not supported.
```

**Verify**: `node --version | grep -E "v2[0-9]\."` or check package.json engines.

### 5. Format Specifications

**Recognition**: Structural patterns, format definitions, schemas.

```markdown
Error responses follow: {error: string, code: number, details?: object}. The
error field contains human-readable text, code identifies the error for client
handling, details provides optional context.

Commit messages use: type(scope): description. Type is feat/fix/docs/refactor/test.
Scope identifies the affected component. Description is present tense.
Example: "feat(auth): add OAuth integration".

API endpoints follow: /api/v{version}/{resource}/{id}. Version is integer
starting at v1. Resources are plural nouns. ID is optional for collections.
Example: /api/v2/orders/12345.

Dates use YYYY-MM-DD HH:mm:ss UTC everywhere — API responses, database
timestamps, and log entries. UTC prevents timezone ambiguity.
```

**Verify**: regex matching on API responses, commit hooks, log output.

### 6. Declarative Statements with Specific Objects

**Recognition**: "will use X", "will include Y", "will follow Z" + specific tech.

```markdown
We will use TypeScript for all new files. Existing JavaScript migrates
opportunistically during feature work.

Public APIs will include JSDoc comments with @param and @returns at minimum.

Async operations will use async/await instead of Promise chains. This applies
to API calls, database queries, and file operations.

Interactive elements include data-testid attributes following
data-testid="{component}-{element}-{action}". Example: loginform-button-submit.
```

**Verify**: `find src -name "*.js" -not -path "*/node_modules/*"` for TypeScript,
grep for JSDoc tags, AST analysis for async patterns.

---

## MEDIUM Enforceability Patterns

Require 1+ of these. Each is checkable by a human reviewer with clear yes/no
judgment.

### 1. Clear Prohibitions

```markdown
We will not use class components for new React code. All new components use
functional components with hooks. Existing class components remain until they
need significant updates.

Custom authentication is prohibited. Authentication uses Auth0. The security
complexity and maintenance burden of custom auth is not justified.

Synchronous file operations will not be used in new code. All file I/O uses
async/await to avoid blocking the event loop.
```

**Why MEDIUM**: "New code" vs legacy requires judgment. A reviewer can tell, but
a script can't reliably distinguish.

### 2. Implementation Requirements

```markdown
All endpoints will enforce input validation. Validation checks data types,
required fields, and business rules before processing.

Public APIs implement rate limiting: 100 req/min authenticated, 20 req/min
anonymous. Rate limit headers included in all responses.

Services use dependency injection for instantiation. The DI container config
lives in src/config/dependencies.ts.
```

**Why MEDIUM**: Clear requirement, but correct implementation varies by context.

### 3. Quality/Security Guidelines

```markdown
Database queries will use parameterized queries. Direct string concatenation
for SQL is prohibited.

Security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS) will be
set on all HTTP responses via security middleware.

Code will pass all ESLint rules before merge. PRs failing linting are blocked
by CI until resolved.
```

**Why MEDIUM**: "Validated for SQL injection" is clear but what constitutes
adequate validation requires judgment.

### 4. Architectural Patterns

```markdown
New services follow microservices architecture: each owns its data, exposes a
REST API, communicates via events for cross-service coordination.

Applications use hexagonal architecture: business logic in domain core,
infrastructure in adapters, external interfaces in ports.
```

**Why MEDIUM**: Correct application of architectural patterns requires judgment.

### 5. Universal Requirements ("all X must Y")

```markdown
All public functions will have unit tests covering happy path, errors, and
edges. Aim for 80% branch coverage.

All environment variables will be documented in the README: name, purpose,
default, example.

All API changes will update the OpenAPI spec in api/openapi.yaml.

All database migrations will be reversible with both up() and down() methods.
```

**Why MEDIUM**: "All" is clear scope, but what constitutes a "public function"
or adequate documentation needs judgment.

---

## LOW Enforceability Patterns

No enforcement mechanism — these provide context and guidance.

### Recommendations

```markdown
Consider performance implications when adding features to the hot path.
Recommend React Server Components where rendering latency matters.
Prefer composition over inheritance for component reuse.
```

### Abstract Principles

```markdown
Follow SOLID principles, particularly Single Responsibility.
Maintain clean architecture philosophy — dependencies point inward.
Apply domain-driven design: bounded contexts, ubiquitous language, aggregates.
```

### Historical Rationale

```markdown
We chose PostgreSQL over MongoDB because our data model is relational.
This decision followed the Twelve-Factor App methodology.
Future iterations may explore GraphQL if REST becomes a bottleneck.
```

---

## Upgrading Between Levels

### LOW to MEDIUM

Add a clear, judgment-checkable guideline:

```
Before: "Follow SOLID principles"
After:  "Each class/module handles one concern. Split modules that mix
         data access with business logic or presentation."
```

### MEDIUM to HIGH

Add specific, measurable constraints:

```
Before: "Must implement error handling"
After:  "All async functions use try-catch with structured logging:
         {level: string, message: string, stack?: string, context?: object}.
         Error format defined in src/types/errors.ts."
```

### Combining MEDIUM Patterns to Reach HIGH

Multiple MEDIUM patterns can reach HIGH when they form a complete, verifiable
system:

```markdown
Data access uses the repository pattern. Repositories are injected via
constructor. All repositories implement IRepository<T> from src/types/. Naming
follows {Entity}Repository (e.g., UserRepository, OrderRepository).
```

Pattern + injection method + interface + naming convention = enough specificity
for automated checking.

---

## Anti-Patterns

These are too vague for any level:

- "Write good code"
- "Use best practices"
- "Make it fast"
- "Keep it simple"
- "Be consistent"
- "Follow standards"

Fix: replace with a specific pattern from the HIGH or MEDIUM sections above.

---

## Quick Reference

| Pattern | Level | Keywords | Example |
|---------|-------|----------|---------|
| File paths | HIGH | backticks, `/` | `src/components/` |
| Measurable | HIGH | numbers + units | `30 seconds`, `250kb` |
| Config values | HIGH | `key: value` | `timeout: 5000` |
| Versions | HIGH | `>=`, minimum | `>= 18.0.0` |
| Format specs | HIGH | format:, structure: | `{a, b, c}` |
| Declarative + specific | HIGH | will use X | "will use TypeScript" |
| Prohibitions | MEDIUM | won't, will not | "won't use classes" |
| Requirements | MEDIUM | must + verb | "must implement" |
| Quality/security | MEDIUM | testing, security | "must validate" |
| Architecture | MEDIUM | pattern, approach | "repository pattern" |
| Universal | MEDIUM | all...must | "all functions must..." |
| Recommendations | LOW | consider, suggest | "consider caching" |
| Principles | LOW | principle, philosophy | "SOLID principles" |
