---
name: git-commit
description: Commit staged changes and push to remote. Use when the user says "commit", "commit and push", "push my changes", "ship it", "save my work", "git commit", or wants to commit code to a branch. Also triggers when the user has finished making changes and wants to push them upstream.
allowed-tools: Read, Bash, Glob
---

# Git Commit and Push

Commit staged git changes with a well-formed message and push to the remote branch. When nothing is staged, intelligently stage relevant unstaged changes before committing.

> **CRITICAL**: Secret scanning (step 1) is a hard gate. No commit may proceed unless it passes. This check overrides everything else in this workflow.

## Workflow

### 1. SCAN FOR PLAIN TEXT SECRETS — MANDATORY, NON-SKIPPABLE

**This is the most important step. Run it before any staging, analysis, or commit work.**

Scan all changes (staged and unstaged) for accidentally committed secrets:

```bash
git diff --cached
git diff
```

Look for patterns that indicate plain text secrets:
- API keys, tokens, or passwords assigned to variables (e.g. `API_KEY = "sk-..."`, `password = "..."`, `token = "abc123"`)
- Private keys or certificates (e.g. `-----BEGIN RSA PRIVATE KEY-----`)
- AWS/GCP/Azure credential patterns
- Hardcoded connection strings with credentials (e.g. `postgres://user:password@host`)
- `.env` files containing real secrets

**If any secrets are found**: STOP IMMEDIATELY. Do not stage, do not commit, do not proceed. Tell the user exactly which file and line contains the suspected secret. Suggest they remove the secret, add the file to `.gitignore`, and use environment variables instead. Do not continue this workflow until the user confirms the secret has been removed.

**If no secrets are found**: proceed to step 2.

---

### 2. Check what's staged

```bash
git branch --show-current
git status --porcelain
```

- If staged changes exist (`^[MARC]`) → skip to step 4
- If nothing is staged but unstaged changes exist (`^.[MARC?]`) → continue to step 3
- If working tree is clean → tell the user "Nothing to commit" and stop

### 3. Smart staging (only when nothing is staged)

Infer the context of the current work from:
- Branch name (e.g. `feat/jwt-auth`, `fix/PROJ-123-login-bug`)
- Recent commit messages: `git log --oneline -5`
- Any filenames or patterns mentioned in the current conversation

Then inspect the unstaged changes:
```bash
git diff --name-status
git diff --stat
```

For any files that look ambiguous, skim the actual diff:
```bash
git diff -- <file>
```

**Stage files that are clearly part of the current work** — files whose changes align with the branch purpose, feature, or bug fix. Skip unrelated changes (e.g. unrelated debug logs, scratch files, changes to a completely different feature area).

```bash
git add <file1> <file2> ...
```

Tell the user which files were staged and why any were skipped, e.g.:
> Staged 4 files related to JWT auth. Skipped `scratch.rb` (unrelated debug output).

### 4. Analyze staged changes

```bash
git diff --cached --name-status
git diff --cached --stat
```

### 5. Create the commit message

Check for a project-specific template at `.github/commit-message-template`. If none exists, use conventional commits:

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

**Types**: feat, fix, docs, style, refactor, perf, test, build, ci, chore
**Description**: imperative mood, 50 chars max, no trailing period
**Body**: optional, 72-char line wrap, explain what and why
**Footer**: breaking changes, issue references

If staged changes fall into multiple clearly distinct logical groups, create separate commits for each — but err toward a single commit unless the separation is obvious.

### 6. Commit and push

```bash
git commit -m "<message>"
git log -1 --oneline
git push origin <current_branch>
```

If the branch has no upstream yet, use `--set-upstream`:
```bash
git push --set-upstream origin <current_branch>
```

### 7. Handle errors

- **Push rejected**: `git pull --rebase` then retry push
- **Merge conflicts**: stop and tell the user to resolve conflicts first
- **Pre-commit hook failure**: stop and report the hook output — never use `--no-verify`
- **Auth failure**: report the error

### 8. Report result

Tell the user what happened in plain language:

> Committed `feat(auth): add JWT token validation` and pushed to `feat/jwt-auth`.

If files were skipped during smart staging, mention them again here so the user knows.
