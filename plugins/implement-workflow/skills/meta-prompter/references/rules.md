# Meta-Prompter Rules

## CLI Usage

```bash
npx meta-prompter-mcp "$ARGUMENTS"
```

### Environment Variables

| Env Var | Default | Description |
|---|---|---|
| `PROMPT_EVAL_API_KEY` | (required) | API key for the chosen provider |
| `PROMPT_EVAL_MODEL` | `anthropic:claude-sonnet-4-5` | Model in `provider:model-id` format |

Supported providers: `anthropic`, `openai`.

Output is JSON containing: scores, strengths, improvements, rewrite, questions.

## Error Handling

If the CLI call fails:

1. **`PROMPT_EVAL_API_KEY not configured`** → use `AskUserQuestion`:

   **Question:** "meta-prompter requires PROMPT_EVAL_API_KEY to be configured. How would you like to proceed?"

   **Options:**
   1. **"Help me set it up"** — Guide user to: https://github.com/delexw/claude-code-misc/tree/main/.claude/mcp/meta-prompter#cli
   2. **"Skip"** — Return empty evaluation, do NOT block the workflow

2. **Any other error** (not installed, npx not found, etc.) → use `AskUserQuestion`:

   **Question:** "meta-prompter CLI is not available. How would you like to proceed?"

   **Options:**
   1. **"Help me set it up"** — Guide user to: https://github.com/delexw/claude-code-misc/tree/main/.claude/mcp/meta-prompter#cli
   2. **"Skip"** — Return empty evaluation, do NOT block the workflow

## Hard Gate

- `global < 8` → prompt not ready, must iterate
- `global >= 8` → prompt passes, proceed to execution
- **Max 3 iterations** → if still `< 8` after 3 attempts, use best-scoring prompt and note the score
