# routine

A Claude Code plugin with skills for implementation, incident response, QA testing, and development tooling.

## Installation

### Option 1: Skills (Recommended)

Install directly to `~/.claude/skills/` using the [Agent Skills](https://agentskills.io) CLI. This is the recommended approach as it avoids known plugin limitations with [hooks](https://github.com/anthropics/claude-code/issues/17688), [model/context/agent](https://github.com/anthropics/claude-code/issues/16803), and [script paths](https://github.com/anthropics/claude-code/issues/11011) not working correctly in plugins.

```bash
npx skills add https://github.com/delexw/claude-code-misc
```

To update to the latest version:

```bash
npx skills update
```

Skills installed this way are available across all your projects without the `routine:` prefix (e.g. `/forge` instead of `/routine:forge`).

### Option 2: Plugin

First add the marketplace, then install the plugin:

```bash
/plugin marketplace add delexw/claude-code-misc
/plugin install routine@delexw-claude-code-misc
```

Or load directly for local development:

```bash
claude --plugin-dir ./path/to/plugins/routine
```

> **Known plugin limitations:**
> - [Skill-scoped hooks not triggered in plugins](https://github.com/anthropics/claude-code/issues/17688) — execution tracing won't work
> - [`context: fork`, `agent`, `model` frontmatter ignored](https://github.com/anthropics/claude-code/issues/16803) — skills run inline instead of as subagents
> - [Relative script paths fail in plugins](https://github.com/anthropics/claude-code/issues/11011) — scripts can't find their own directory

## Setup

### Required

| Dependency | Description |
|---|---|
| [jira-cli](https://github.com/ankitpokhrel/jira-cli) | Jira CLI tool |
| [confluence-cli](https://github.com/pchuri/confluence-cli) | Confluence CLI tool |
| `JIRA_API_TOKEN` | [Jira API token](https://id.atlassian.com/manage-profile/security/api-tokens) — set as env var |

### Optional

| Dependency | Description |
|---|---|
| [Figma MCP](https://github.com/nichochar/figma-mcp) | Read Figma designs from ticket links |
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Browser automation for QA testing and visual verification |
| `PROMPT_EVAL_API_KEY` | Prompt optimization via [meta-prompter](https://github.com/delexw/claude-code-misc/tree/main/.claude/mcp/meta-prompter#cli) |
| `PROMPT_EVAL_MODEL` | Model for prompt evaluation (default: `anthropic:claude-sonnet-4-5`). Format: `provider:model-id` |

## Skills

### Implementation

| Skill | Description |
|---|---|
| `forge` | Spec-driven JIRA ticket implementation — the agent explores the codebase to generate the spec itself, then executes in a clean context using the user's installed skills. See [forge README](skills/forge/README.md). |
| `jira-ticket-viewer` | Fetches and parses JIRA tickets via `--raw` JSON |
| `jira-ticket-prioritizer` | Analyzes JIRA tickets to determine priority and dependency order |
| `confluence-page-viewer` | Reads Confluence pages |
| `figma-reader` | Reads Figma designs via MCP |
| `domain-discover` | Discovers and documents codebase domain knowledge |
| `meta-prompter` | Evaluates and optimizes prompts before execution |

### QA / Testing

| Skill | Description |
|---|---|
| `qa-web-test` | Visual regression testing, responsive breakpoint validation, CSS layout debugging via Chrome DevTools MCP |
| `page-inspector` | Captures page layout, styles, and structure as a pre-implementation baseline via Chrome DevTools MCP |

### Incident Response

| Skill | Description |
|---|---|
| `pir` | Creates Post Incident Records by orchestrating pagerduty-oncall, datadog-analyser, cloudflare-traffic-investigator, and rollbar-reader concurrently, then synthesises findings via NotebookLM (report + infographic + flashcards) using `nlm-skill` |
| `pagerduty-oncall` | Investigates PagerDuty incidents for on-call escalation policies |
| `datadog-analyser` | Analyses Datadog observability data (metrics, logs, monitors, incidents, SLOs, APM, RUM, security signals) |
| `cloudflare-traffic-investigator` | Investigates traffic anomalies on Cloudflare-protected domains. See [README](skills/cloudflare-traffic-investigator/README.md). |
| `rollbar-reader` | Investigates Rollbar errors, items, occurrences, deploys, and project health |

### Development Tools

| Skill | Description |
|---|---|
| `oxlint` | Runs and configures oxlint (high-performance JS/TS linter) |
| `adr-author` | Guides writing enforceable Architectural Decision Records |
| `a2a-js-dev` | Builds A2A (Agent-to-Agent) protocol apps using @a2a-js/sdk |
