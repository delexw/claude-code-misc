# implement-workflow

A Claude Code plugin that orchestrates JIRA ticket implementation end-to-end: fetches ticket details, discovers domain knowledge, scans linked resources and designs, optimizes the prompt, then executes the task.

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
| `PROMPT_EVAL_API_KEY` | Prompt optimization via [meta-prompter](https://github.com/delexw/claude-code-misc/tree/main/.claude/mcp/meta-prompter#cli) |

## Usage

```
/implement-workflow:implement <JIRA-URL> ["optional context"]
```

Example:
```
/implement-workflow:implement https://myco.atlassian.net/browse/PROJ-123
```

## Skills Included

| Skill | Description |
|---|---|
| `implement` | Orchestrator — runs all phases end-to-end |
| `jira-ticket-viewer` | Fetches and parses JIRA tickets via `--raw` JSON |
| `confluence-page-viewer` | Reads Confluence pages |
| `figma-reader` | Reads Figma designs via MCP |
| `domain-discover` | Discovers codebase domain knowledge |
| `meta-prompter` | Evaluates and optimizes prompts before execution |
