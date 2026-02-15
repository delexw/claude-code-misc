# Meta-Prompter Rules

## CLI Usage

```bash
npx meta-prompter-mcp [--model <provider:model-id>] "$ARGUMENTS"
```

### CLI Parameters

| Flag | Description |
|---|---|
| `--model <key>` | Model in `provider:model-id` format (e.g. `anthropic:claude-opus-4-6`) |
| `--api-key <key>` | API key (falls back to `PROMPT_EVAL_API_KEY` env) |
| `--compact` | Output compact JSON |

Supported providers: `anthropic`, `openai`.

### Pre-flight Checks

Before calling the CLI, verify the following. If any check fails, use `AskUserQuestion` with the options shown. Do NOT proceed until resolved or skipped.

1. **API key**: Check if `PROMPT_EVAL_API_KEY` env is set (run `echo $PROMPT_EVAL_API_KEY` via Bash). If not set → ask:
   - **"Help me set it up"** — Guide user to: https://github.com/delexw/claude-code-misc/tree/main/.claude/mcp/meta-prompter#cli
   - **"Skip"** — Return empty evaluation, do NOT block the workflow

2. **Model**: Check if `PROMPT_EVAL_MODEL` env is set.
   - If set → omit `--model` (the CLI uses the env var)
   - If **not** set:
     - Ask the current agent for its model provider and model ID
     - If the provider is `openai` and the model ID looks generic (e.g. `gpt-5` without a specific version suffix) → resolve the actual model from `~/.codex/config.toml` by running:
       ```bash
       node -e "const fs=require('fs'),m=fs.readFileSync(require('os').homedir()+'/.codex/config.toml','utf8').match(/^model\s*=\s*\"(.+)\"/m);console.log(m?m[1]:'')"
       ```
       Use the output as the model ID (e.g. `gpt-5.3-codex`). If the file doesn't exist or the output is empty, fall back to the agent-reported model ID.
     - If the provider is supported (`anthropic`, `openai`) → pass `--model <provider>:<model-id>` (e.g. `--model anthropic:claude-opus-4-6`, `--model openai:gpt-5.3-codex`)
     - If the provider is not supported or the agent does not provide them → use `AskUserQuestion` to ask the user for the `provider:model-id` value, then pass it via `--model`

Output is JSON containing: scores, strengths, improvements, rewrite, questions.

## Error Handling

If the CLI call fails at runtime (e.g. not installed, npx not found) → use `AskUserQuestion`:

- **"Help me set it up"** — Guide user to: https://github.com/delexw/claude-code-misc/tree/main/.claude/mcp/meta-prompter#cli
- **"Skip"** — Return empty evaluation, do NOT block the workflow

## Hard Gate

- `global < 8` → prompt not ready, must iterate
- `global >= 8` → prompt passes, proceed to execution
- **Max 3 iterations** → if still `< 8` after 3 attempts, use best-scoring prompt and note the score
