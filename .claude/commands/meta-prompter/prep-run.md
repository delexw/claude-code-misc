---
description: Evaluate the input prompt, clarify with context, then execute the final prompt in thinking mode
argument-hint: paste/type prompt to evaluate then perform OR type resume
---

# /meta-prompter:prep-run

Read ~/.claude/commands/meta-prompter/eval.md and save it into <meta_prompter_eval> tag

## Session
- If starting fresh: create **SESSION_ID** = `sess-YYYYMMDD-HHMMSS` and use it for all files.
- If resuming: if `$ARGUMENTS` starts with `resume`, extract `<session_id>` (e.g., `resume sess-20250809-104200`). If missing, ask the user to pick one from `./tmp/meta-prompter/eval/*/`.

<state_files>
  <prompt_eval>./tmp/meta-prompter/eval/<session_id>/prompt_eval.json</prompt_eval>  (evaluation result + original_prompt)
  <clarification_answers>./tmp/meta-prompter/eval/<session_id>/answers.json</clarification_answers>      (answers to the 3 questions)
</state_files>

<hard_gate>
  <global_below_8>global < 8<global_below_8>
  <global_geq_8>global >= 8</global_geq_8>
</hard_gate>

<choose_command>
  - Ask the user to choose the exact <USER_COMMAND> to run <FINAL_PROMPT>, e.g.:
    - SuperClaude: `/sc:build` or `/sc:run` etc.
    - SimpleClaude: `/sc-create` or `/sc-fix` etc.
    - Another `/...` command of their choice
  - Validation: if a command is provided, it must start with `/`. If not, ask again briefly.
</choose_command>

<confirm_command>
  - Construct: **`<USER_COMMAND> "<FINAL_PROMPT>"`**
  - Always wrap <FINAL_PROMPT> in quotes and escape any quotes inside it.
  - Show the composed command and ask for <Y/N> confirmation.
  - If <N>, allow edits to the command, then recompute.
</confirm_command>

<improtant_steps>
  - Execute from step A to E
<improtant_steps>

You should execute all of the improtant_steps 

## A) Evaluate
- If $ARGUMENTS ≠ "resume" and prompt_eval.json doesn’t exist:
  1. Run: meta_prompter_eval (prints JSON in chat)
  2. Save that JSON to prompt_eval (mkdir -p if needed) and include:
     - "original_prompt": "$ARGUMENTS"
- Otherwise, skip to Clarify.

## B) Clarify
- If clarification_answers is missing or incomplete:
  - Load prompt_eval
  - Attempt to answer the 3 questions based on chat context
  - If you don't have enough context to answer:
    - **IMPORTANT** Ask the 3 questions sequentially
    - Highlight each with a randomly chosen ANSI color code
  - Append and save the questions to answers to clarification_answers as:
    ```json
    { "answers": [
      {"q": "<question1>", "answer": "<user answer>"},
      {"q": "<question2>", "answer": "<user answer>"},
      {"q": "<question3>", "answer": "<user answer>"}
    ] }
    ```

## C) Build PROMPT
- Proceed only when all 3 answers are present and clear.
- Build **PROMPT**:
  - Base = (`rewrite` if non-empty) else `original_prompt`
  - Append a short **Clarifications** section from the 3 answers (concise bullet points).

## D) Re-evaluate and gate
- Think the re-evaluation process carefully
- Re-run meta_prompter_eval on the built **PROMPT** in Task()
  - Overwrite prompt_eval with this latest evaluation JSON result (preserve `"original_prompt"` and, if present, `"contextual_prompt"`).
  - When global_below_8:
    - **STOP execution immediately.**
    - **Do NOT invent questions.** Use the **3 questions returned by this re-evaluation**.
    - Redo **B) Clarify**, redo **C) Build PROMPT**, and **re-run this step (D)**.
- **Repeat** until global_geq_8, then proceed using the <FINAL_PROMPT>.

## E) Execute

### Choose a framework command
- Ask user to choose_command
- If no <USER_COMMAND> is provided, skip to internal execution.
- If <USER_COMMAND> is provide, confirm_command

### Perform the task
- **If a framework command was confirmed:** run it, e.g. `/sc:build "<FINAL_PROMPT>"`.
- **If no command was provided:** execute internally using <FINAL_PROMPT>.
  - **Code:** outline a minimal plan; edit only necessary files; run the project’s own checks (e.g., `npm test`, `make test`, linters, type checks) **if available**. If unknown, add TODOs instead of guessing.
  - **Content/Docs:** save outputs to the project’s standard location (**prefer repo conventions**; if unclear, use `./artifacts/` as a fallback and note it).
  - **Safety:** avoid destructive actions; require explicit confirmation for risky steps (migrations, data changes); include a brief rollback note.

<tags>
   <mode>think hard</mode>
   <custom>yes</custom>
</tags>