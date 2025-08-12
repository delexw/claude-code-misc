---
description: Evaluate the input prompt, clarify with context, then execute the final prompt
argument-hint: paste/type prompt to evaluate then perform OR type resume
---

# /meta-prompter:prep-run

## Session
- If starting fresh: create **SESSION_ID** = `sess-YYYYMMDD-HHMMSS` and use it for all files.
- If resuming: if `$ARGUMENTS` starts with `resume`, extract `<session_id>` (e.g., `resume sess-20250809-104200`). If missing, ask the user to pick one from `./tmp/meta-prompter/eval/*/`.

## State files
- ./tmp/meta-prompter/eval/<session_id>/prompt_eval.json  (evaluation result + original_prompt)
- ./tmp/meta-prompter/eval/<session_id>/answers.json      (answers to the 3 questions)

## A) Evaluate
- If $ARGUMENTS ≠ "resume" and prompt_eval.json doesn’t exist:
  1. Run: `/meta-prompter:eval $ARGUMENTS` (prints JSON in chat)
  2. Save that JSON to `./tmp/meta-prompter/eval/<session_id>/prompt_eval.json` (mkdir -p if needed) and include:
     - "original_prompt": "$ARGUMENTS"
- Otherwise, skip to Clarify.

## B) Clarify
- If answers.json is missing or incomplete:
  - Load `@tmp/meta-prompter/eval/<session_id>/prompt_eval.json`.
  - Attempt to answer the 3 questions based on chat context
  - If you don't have enough context to answer:
    - **IMPORTANT** Ask the 3 questions sequentially
    - Highlight each with a randomly chosen ANSI color code
  - Save `./tmp/meta-prompter/eval/<session_id>/answers.json` as:
    ```json
    { "answers": [
      {"q": 1, "answer": "<user answer>"},
      {"q": 2, "answer": "<user answer>"},
      {"q": 3, "answer": "<user answer>"}
    ] }
    ```

## C) Build FINAL_PROMPT
- Proceed only when all 3 answers are present and clear.
- Build **FINAL_PROMPT**:
  - Base = (`rewrite` if non-empty) else `original_prompt`
  - Append a short **Clarifications** section from the 3 answers (concise bullet points).

## D) Re-evaluate and gate
- Re-run evaluation on **FINAL_PROMPT**:  
  `/meta-prompter:eval "<FINAL_PROMPT>"`
- Overwrite `./tmp/meta-prompter/eval/<session_id>/prompt_eval.json` with this latest evaluation JSON result (preserve `"original_prompt"` and, if present, `"final_prompt"`).
- If `global < 8`:
  - **STOPPED execution immediately.**
  - **Do NOT invent questions.** Use the **3 questions returned by this re-evaluation**.
  - Redo **B) Clarify**, redo **C) Build FINAL_PROMPT**, and **re-run this step (D)**.
- Repeat until `global >= 8`, then proceed.

## E) Execute

### Choose a framework command (optional)
- Ask the user to choose the exact command to run **FINAL_PROMPT**, e.g.:
  - **SuperClaude:** `/sc:build` or `/sc:run` etc.
  - **SimpleClaude:** `/sc-create` or `/sc-fix` etc.
  - Another `/...` command of their choice
- **Validation:** if a command is provided, it must start with `/`. If not, ask again briefly.
- If no command is provided, skip to internal execution.

### Compose and confirm (only if a user-preferred command was provided)
- Construct: **`<USER_COMMAND> "<FINAL_PROMPT>"`**
  - Always wrap FINAL_PROMPT in quotes and escape any quotes inside it.
- **IMPORTANT** Show the composed command and ask for **Y/N** confirmation.
  - If **N**, allow edits to the command, then recompute.

### Perform the task
- **If a framework command was confirmed:** run it, e.g. `/sc:build "<FINAL_PROMPT>"`.
- **If no command was provided:** execute internally using FINAL_PROMPT.
  - **Code:** outline a minimal plan; edit only necessary files; run the project’s own checks (e.g., `npm test`, `make test`, linters, type checks) **if available**. If unknown, add TODOs instead of guessing.
  - **Content/Docs:** save outputs to the project’s standard location (**prefer repo conventions**; if unclear, use `./artifacts/` as a fallback and note it).
  - **Safety:** avoid destructive actions; require explicit confirmation for risky steps (migrations, data changes); include a brief rollback note.