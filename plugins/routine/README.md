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

## Get Shit Done — Skill Dependency Tree

The `get-shit-done` orchestrator (`agents/src/get-shit-done.ts`) drives the full implementation pipeline. Below is the complete skill dependency tree including third-party skills.

```
get-shit-done
│
├─ jira-ticket-prioritizer
│
├─ forge
│  ├─ jira-ticket-viewer
│  ├─ domain-discover
│  ├─ confluence-page-viewer          (conditional)
│  ├─ figma-reader                    (conditional)
│  │  └─ Figma MCP server
│  ├─ page-inspector                  (conditional)
│  │  └─ pinchtab ★
│  ├─ meta-prompter
│  └─ {ticket_id}-impl               (dynamically generated)
│
├─ verification
│  └─ autoresearch ★
│     ├─ codex-review ★
│     └─ qa-web-test                  (conditional, if dev server)
│        └─ pinchtab ★
│
├─ git-commit
│
└─ create-pr
```

Skills marked with ★ are **third-party** — not bundled in this plugin. Install them separately (see setup tables below).

## Setup

> **Reminder:** Ensure each CLI tool is installed and available in your Claude Code session context (i.e. on `$PATH`) before invoking the skill that needs it. If a CLI is missing at runtime the skill will fail. You can verify with `which <tool>` or `<tool> --version`.

### Implementation (Forge workflow)

| Skill | CLI / Tool | Env Vars | Install |
|---|---|---|---|
| `forge` | `git` | — | ships with macOS / Xcode CLT |
| `jira-ticket-viewer` | `jira` | `JIRA_API_TOKEN` | [jira-cli](https://github.com/ankitpokhrel/jira-cli) |
| `jira-ticket-prioritizer` | `jira` | `JIRA_API_TOKEN` | [jira-cli](https://github.com/ankitpokhrel/jira-cli) |
| `confluence-page-viewer` | `npx confluence-cli` | `CONFLUENCE_USERNAME`, `CONFLUENCE_PASSWORD` | `npm i -g confluence-cli` / [confluence-cli](https://github.com/pchuri/confluence-cli) |
| `figma-reader` | — | — | [Figma MCP](https://github.com/nichochar/figma-mcp) server |
| `page-inspector` | — | — | delegates to `pinchtab` ★ |
| `meta-prompter` | `npx meta-prompter-mcp` | `PROMPT_EVAL_API_KEY`, `PROMPT_EVAL_MODEL` | [meta-prompter](https://github.com/delexw/claude-code-misc/tree/main/.claude/mcp/meta-prompter#cli) |
| `domain-discover` | `git` | — | ships with macOS / Xcode CLT |

### QA / Verification

| Skill | CLI / Tool | Env Vars | Install |
|---|---|---|---|
| `qa-web-test` | — | — | delegates to `pinchtab` ★ |
| `codex-review` ★ | `codex` | `OPENAI_API_KEY` | [Codex CLI](https://github.com/openai/codex) |
| `verification` | `codex` | `OPENAI_API_KEY` | orchestrates `autoresearch` → `codex-review` + `qa-web-test` |

### Third-party skills ★

These skills are depended on but not bundled. Install them separately.

| Skill | CLI / Tool | Env Vars | Install |
|---|---|---|---|
| `pinchtab` ★ | `pinchtab`, Chrome/Chromium | `PINCHTAB_TOKEN` (optional) | `brew install pinchtab/tap/pinchtab` / [pinchtab](https://github.com/pinchtab/pinchtab) — requires Chrome or Chromium installed |
| `autoresearch` ★ | — | — | [autoresearch](https://github.com/jmadden/autoresearch) — `npx skills add https://github.com/jmadden/autoresearch` |
| `codex-review` ★ | `codex` | `OPENAI_API_KEY` | [Codex CLI](https://github.com/openai/codex) |

### Incident Response (PIR workflow)

| Skill | CLI / Tool | Env Vars | Install |
|---|---|---|---|
| `pagerduty-oncall` | `pd` | `PAGERDUTY_API_TOKEN` | [PagerDuty CLI](https://github.com/martindstone/pagerduty-cli) |
| `datadog-analyser` | `pup` | `DD_API_KEY`, `DD_APP_KEY` | [Pup CLI](https://github.com/DataDog/pup) |
| `cloudflare-traffic-investigator` | `cloudflare-mcp-cli` | `CLOUDFLARE_API_TOKEN` | [cloudflare-mcp-cli](https://github.com/nichochar/cloudflare-mcp-cli) |
| `rollbar-reader` | `rollbar` | `ROLLBAR_TOKEN` | [Rollbar CLI](https://github.com/nichochar/rollbar-cli) |
| `nlm-skill` ★ | `nlm` | — | [nlm-skill](https://github.com/nichochar/nlm-skill) — install via `npx skills add https://github.com/nichochar/nlm-skill` |

### Git / GitHub

| Skill | CLI / Tool | Env Vars | Install |
|---|---|---|---|
| `git-commit` | `git` | — | ships with macOS / Xcode CLT |
| `create-pr` | `git`, `gh` | `GITHUB_TOKEN` | [GitHub CLI](https://cli.github.com/) |

### Code Quality

| Skill | CLI / Tool | Env Vars | Install |
|---|---|---|---|
| `oxlint` | `npx oxlint` | — | auto-downloaded via npx |
| `oxfmt` | `oxfmt` | — | [oxfmt](https://github.com/nichochar/oxfmt) |

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
| `qa-web-test` | Visual regression testing, responsive breakpoint validation, CSS layout debugging via PinchTab |
| `page-inspector` | Captures page layout, styles, and structure as a pre-implementation baseline via PinchTab |

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
