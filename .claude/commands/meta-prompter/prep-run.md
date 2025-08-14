---
description: Evaluate the input prompt, clarify with context, then execute the final prompt in thinking mode
argument-hint: paste/type prompt to evaluate -> perform
---

# /meta-prompter:prep-run

Read ~/.claude/commands/meta-prompter/eval.md and save it into <meta_prompter_eval> tag

## Session
- If starting fresh: create **SESSION_ID** = `sess-YYYYMMDD-HHMMSS` and use it for all files.

<hard_gate>
  <global_below_8>global < 8<global_below_8>
  <global_geq_8>global >= 8</global_geq_8>
</hard_gate>

You should execute all of the improtant_steps 

<improtant_steps>
  - Execute from step A to E
<improtant_steps>

## A) Evaluate
- If <prompt_eval> tag doesn’t exist:
  1. Run: meta_prompter_eval (prints JSON in chat)
  2. Save that JSON to <prompt_eval> and include:
     - "original_prompt": "$ARGUMENTS"
- Otherwise, skip to Clarify.

## B) Clarify
- If <clarification_answers> tag is missing or incomplete:
  - Follow clarification_process
  - Append and save the questions and answers to <clarification_answers> tag as:
    ```json
    { "answers": [
      {"q": "<question1>", "answer": "<user answer>"},
      {"q": "<question2>", "answer": "<user answer>"},
      {"q": "<question3>", "answer": "<user answer>"}
    ] }
    ```
<clarification_process>
  - Read the 3 questions from <prompt_eval> 
  - Attempt to answer all questions based on context
  - If you don't have enough context to answer:
    - Ask each questions sequentially
    - Highlight each with a randomly chosen ANSI color code
</clarification_process>

## C) Build PROMPT
- Proceed only when all 3 answers are present and clear.
- Build **PROMPT**:
  - Base = (`rewrite` if non-empty) else `original_prompt`
  - Append a short **Clarifications** section from the 3 answers (concise bullet points).

## D) Re-evaluate and gate
- Think the re-evaluation process carefully
- Re-run meta_prompter_eval on the built **PROMPT**
  - Overwrite <prompt_eval> with this latest evaluation JSON result (preserve `"original_prompt"` and, if present, `"contextual_prompt"`).
  - When global_below_8:
    - **STOP execution immediately.**
    - **Do NOT invent questions.** Use the **3 questions returned by this re-evaluation**.
    - Redo **B) Clarify**, redo **C) Build PROMPT**, and **re-run this step (D)**.
- **Repeat** until global_geq_8, then proceed using the <FINAL_PROMPT>.

## E) Execute
- **MUST execute <FINAL_PROMPT>**
  - **Code:** outline a minimal plan; edit only necessary files; run the project’s own checks (e.g., `npm test`, `make test`, linters, type checks) **if available**. If unknown, add TODOs instead of guessing.
  - **Content/Docs:** save outputs to the project’s standard location (**prefer repo conventions**; if unclear, use `./docs/` as a fallback and note it).
  - **Safety:** avoid destructive actions; require explicit confirmation for risky steps (migrations, data changes); include a brief rollback note.



<tags>
   <mode>think hard</mode>
   <custom>yes</custom>
</tags>