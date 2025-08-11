# Claude Code Misc

Collection of Claude Code configurations and MCP servers.

## MCP Servers

### Meta-Prompter MCP
**Location**: `.claude/mcp/meta-prompter/`

A tiny meta‑prompt MCP server that grades prompts and returns JSON‑only analysis. Evaluates prompts across 8 dimensions (clarity, specificity, context, actionability, safety, testability, hallucination prevention, token efficiency) with weighted global scoring.

**Key Features**:
- Temperature-controlled evaluation (0 vs Claude Code's default 1)
- Machine-readable JSON output for agentic workflows  
- Built-in result viewer with `eval-viewer.html`
- Support for multiple AI providers (Anthropic, OpenAI)

See [meta-prompter README](.claude/mcp/meta-prompter/README.md) for detailed setup and usage instructions.

## Claude Code Configuration

### Commands
**Location**: `.claude/commands/`

Custom slash commands for Claude Code:

- **`/meta-prompter:eval`** - Quick prompt evaluation via **Meta-Prompter MCP**, returns JSON scores and analysis
- **`/meta-prompter:prep-run`** - Full workflow: evaluate → clarify → execute with quality gates (global score ≥8)

### StatusLine
**Location**: `.claude/statusline/`

Context monitoring script that displays real-time usage:
- **`ctx_monitor.js`**
  - Shows context window usage percentage with color coding (green/yellow/red)
  - Tracks session ID and token consumption
  - Displays model name and usage statistics

**Features**:
- Real-time context window monitoring (0-200k tokens)
- Color-coded usage indicators  
- Session tracking and identification
- Automatic synthetic message filtering

![alt text](image.png)
