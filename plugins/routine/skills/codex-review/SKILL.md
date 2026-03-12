---
name: codex-review
description: Run a code review using the OpenAI Codex CLI (`codex review`) on staged, unstaged, or branch changes before committing. Use this skill whenever the user asks to review code with codex, wants a pre-commit review, mentions "codex review", or asks for an AI-powered code review of their changes. Also trigger when the user says things like "review my changes before committing", "run codex on my diff", or "check my code with codex".
argument-hint: "[review prompt]"
---

# Codex CLI Code Review

Use the `codex review` command to get an AI-powered code review of the current changes.

## Workflow

### 1. Check codex CLI availability

Run `which codex` to confirm it's installed. If not found, tell the user:
"The codex CLI is not installed. Install it with `npm install -g @openai/codex` or see https://github.com/openai/codex"

### 2. Determine what to review

Pick the right flag based on context:

- **Staged changes only** (default before a commit): `codex review`
- **All local changes** (staged + unstaged + untracked): `codex review --uncommitted`
- **Changes against a branch**: `codex review --base <branch>`
- **A specific commit**: `codex review --commit <sha>`

If the user doesn't specify, check `git diff --cached --stat` first. If there are staged changes, review those. Otherwise fall back to `--uncommitted`.

### 3. Run the review

```shell
codex review "<prompt>"
```

**IMPORTANT:** Use a **10-minute timeout** (600000ms) for the Bash command — codex streams from the OpenAI API and large diffs can take several minutes to complete. The default 2-minute timeout will cause the stream to disconnect mid-review.

The prompt should describe what to focus on. If the user provided `$ARGUMENTS`, use that as the prompt. Otherwise use a sensible default like `"review the changes for bugs, style issues, and potential improvements"`.

If the command fails due to environment issues (missing API key, network error, etc.), try these in order:
1. Check if `OPENAI_API_KEY` is set
2. Try running with `--config model="gpt-5.2"` as a fallback model
3. If still failing, report the error and skip the review

### 4. Save the review output

Save the full codex review output to `.codex-review-output.md` in the repository root.

### 5. Handle the review output

- **No issues found**: Report that the review passed clean and proceed.
- **Minor suggestions**: Summarize them for the user. These are informational — the user can decide whether to act on them.
- **Critical issues** (bugs, security vulnerabilities, logic errors): Summarize the critical findings clearly. Ask the user whether they want to fix these before proceeding. If yes, make the fixes but do NOT commit — present the changes for human review first.

### 6. Environment troubleshooting

The codex CLI depends on:
- Node.js runtime
- `OPENAI_API_KEY` environment variable
- Network access to OpenAI API

If running through asdf/nvm, the shim path may need to be resolved. Try `$(which codex)` or the full path if the shim doesn't work in the current shell context.
