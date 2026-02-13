# Meta-Prompter Rules

## Pre-flight Check

No separate pre-flight step. Run `npx meta-prompter-mcp "Your prompt here"` directly as the first evaluation call. If it returns an error:

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

## CLI Usage

Evaluate a prompt:
```bash
npx meta-prompter-mcp "Your prompt here"
```

Output is JSON containing: scores, strengths, improvements, rewrite, questions.

## Hard Gate

- `global < 8` → prompt not ready, must iterate
- `global >= 8` → prompt passes, proceed to execution
- **Max 3 iterations** → if still `< 8` after 3 attempts, use best-scoring prompt and note the score
