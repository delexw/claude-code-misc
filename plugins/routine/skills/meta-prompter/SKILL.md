---
name: meta-prompter
description: Evaluate and optimize prompts. Iterates until quality gate passes, then returns the final prompt for the caller to execute.
argument-hint: <prompt to evaluate and optimize>
allowed-tools: Read, Bash
---

# Meta-Prompter

Prompt evaluation and optimization using the `meta-prompter-mcp` CLI. Returns <FINAL_PROMPT> for the caller to execute.

## Arguments
- `$ARGUMENTS` — The prompt to evaluate and optimize

## Session
- If starting fresh: create **SESSION_ID** = `sess-YYYYMMDD-HHMMSS` and use it for all files.

## Execution

See [references/rules.md](references/rules.md) for CLI usage, environment variables (model configuration), and error handling.

Execute all steps A through E:

### A) Evaluate
- If <prompt_eval> tag doesn't exist:
  1. Run: `npx meta-prompter-mcp "$ARGUMENTS"` via Bash, with `--model` flag per [references/rules.md](references/rules.md) model resolution
  2. Save the JSON output to <prompt_eval> and include:
     - "original_prompt": "$ARGUMENTS"
- Otherwise, skip to Clarify.

### B) Clarify
- If <clarification_answers> tag is missing or incomplete:
  - Read the 3 questions from <prompt_eval>
  - Attempt to answer all questions based on context
  - If you don't have enough context to answer:
    - Use `AskUserQuestion` tool to ask each question
  - Save the questions and answers to <clarification_answers> tag as:
    ```json
    { "answers": [
      {"q": "<question1>", "answer": "<user answer>"},
      {"q": "<question2>", "answer": "<user answer>"},
      {"q": "<question3>", "answer": "<user answer>"}
    ] }
    ```

### C) Build PROMPT
- Proceed only when all 3 answers are present and clear.
- Build **PROMPT**:
  - Base on `rewrite` from evaluation result
  - Append a short **Clarifications** section from the 3 answers (concise bullet points).

### D) Re-evaluate and gate
- Think the re-evaluation process carefully
- Re-run `npx meta-prompter-mcp "<built PROMPT>"` via Bash (with `--model` flag per [references/rules.md](references/rules.md) model resolution)
  - Overwrite <prompt_eval> with this latest evaluation JSON result (preserve `"original_prompt"` and, if present, `"contextual_prompt"`).
  - When `global < 8`:
    - **STOP execution immediately.**
    - **Do NOT invent questions.** Use the **3 questions returned by this re-evaluation**.
    - Redo **B) Clarify**, redo **C) Build PROMPT**, and **re-run this step (D)**.
- **Repeat** until `global >= 8`, then proceed using the <FINAL_PROMPT>.
- **Max 3 iterations.** If `global < 8` after 3 attempts, use the best-scoring prompt as <FINAL_PROMPT> and note the score.

### E) Return
- Return <FINAL_PROMPT> to the caller for execution

<tags>
   <mode>think hard</mode>
   <custom>yes</custom>
</tags>
