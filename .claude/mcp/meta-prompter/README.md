# Meta Prompter

**A prompt evaluation tool available as both an MCP server and a standalone CLI.**

## What it does

Evaluates a prompt across 8 dimensions (clarity, specificity, context, actionability, safety, testability, hallucination prevention, token efficiency), computes a weighted **global** score, and—if needed—returns a full rewrite. Zero fluff, machine‑friendly.

Available as an **MCP server** and a **CLI** — both can be used by [Claude Code Skills](https://docs.anthropic.com/en/docs/claude-code/skills) for agentic prompt evaluation workflows.

### Quick theory

- On the basis of the paper [Meta-Prompting](https://arxiv.org/pdf/2401.12954)
  
- The model’s task is to analyze another prompt, not perform the end‑task — prompts about prompts = meta.

- **LLM‑as‑a‑Judge**: role + rubric + constrained JSON output approximates structured human evaluation.

- **Form‑filling graders (e.g., G‑Eval)**: schema‑locked fields and brief justifications reduce variance and make results comparable.

- **Rule‑guided critique (Constitutional‑style)**: conflict rules, edge‑case handling, and safety checks function as a small “constitution.”

- **Reflection/self‑critique patterns**: institutionalizes a critique step that boosts reliability before you ship a prompt.

> One‑liner: it treats prompts as artifacts to be graded with rules, not instructions to be executed.


## Why a separate evaluation model?

Claude Code doesn't allow customizing the LLM temperature. Its default temperature is `1`. For more stable scoring, use a lower temperature — this reduces randomness in sampling, ensuring that scores and justifications remain consistent across runs. The evaluation model uses temperature `0`.

Both the MCP server and CLI share the same core evaluation logic, so results are identical regardless of how you invoke it.

## MCP Server

Use the MCP server for agentic integration — it provides **structured output** (`outputSchema` + `structuredContent`) so agents can act on evaluation data programmatically.

### Setup

```bash
claude mcp add meta-prompter \
  --env PROMPT_EVAL_MODEL=anthropic:claude-sonnet-4-20250514 \
  --env PROMPT_EVAL_API_KEY=<claude_api_key> \
  -- npx -y meta-prompter-mcp@latest
```

### JSON Configuration
```json
    "meta-prompter": {
      "command": "npx",
      "args": [
        "-y",
        "meta-prompter-mcp@latest"
      ],
      "env": {
        "PROMPT_EVAL_MODEL": "anthropic:claude-sonnet-4-20250514",
        "PROMPT_EVAL_API_KEY": "sk-123456789",
      }
    }
```

### Available Tools

- `evaluate` - Evaluate a prompt using AI analysis.
    - `prompt` (string, required): The prompt to evaluate
- `ping` - Simple ping test to verify connection

## CLI

Use the CLI for quick evaluations from the terminal, scripts, or CI pipelines.

```bash
# Install globally
npm install -g meta-prompter-mcp@latest

# Or run directly with npx
npx meta-prompter-mcp meta-prompter "Your prompt here"
```

### Usage

```bash
meta-prompter [options] [prompt]
```

**Arguments:**
- `prompt` — The prompt to evaluate (or pipe via stdin)

**Options:**
- `--prompt <text>` — The prompt to evaluate (alternative to positional arg)
- `--model <key>` — Model key (default: `PROMPT_EVAL_MODEL` env or `anthropic:claude-sonnet-4-20250514`)
- `--api-key <key>` — API key (default: `PROMPT_EVAL_API_KEY` env)
- `--compact` — Output compact JSON instead of pretty-printed
- `-h, --help` — Show help message
- `-v, --version` — Show version number

### Examples

```bash
# Positional argument
PROMPT_EVAL_API_KEY=sk-... meta-prompter "Write a function that sorts an array"

# Flag
meta-prompter --api-key sk-... --prompt "Write a function that sorts an array"

# Pipe from stdin
echo "Write a function that sorts an array" | meta-prompter --api-key sk-...

# Pipe from file
cat my-prompt.txt | meta-prompter --api-key sk-...

# Compact output for piping to jq
meta-prompter --api-key sk-... --compact "test prompt" | jq '.scores.global'
```

## Environment Variables

Both MCP and CLI use the same environment variables:

- `PROMPT_EVAL_MODEL` - Model key in `provider:model-id` format (default: `anthropic:claude-sonnet-4-20250514`, also supports `openai:gpt-5`)
- `PROMPT_EVAL_API_KEY` - API key for the chosen provider

The CLI also accepts `--model` and `--api-key` flags to override these.

## View Eval Results

Each evaluation is appended to `evaluation_result.jsonl` in the current working directory.

`eval-viewer.html` is the SPA used to view the eval result jsonl data. Open it in a browser and upload the file.

![A cute evaluation](./../../../eval-viewer.png)

## Testing

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## Publishing

- Ensure the latest version is committed in the `package.json` following [Semantic Versioning](https://semver.org/spec/v2.0.0.html). e.g. `"version": "1.1.1"`
- Run `./setup.sh`
- Run `npm publish --tag latest`
