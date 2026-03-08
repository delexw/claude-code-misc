---
name: git-commit
description: Commit staged changes and push to remote. Use when the user says "commit", "commit and push", "push my changes", "ship it", "save my work", "git commit", or wants to commit code to a branch. Also triggers when the user has finished making changes and wants to push them upstream.
allowed-tools: Read, Bash, Glob
---

# Git Commit and Push

Commit staged git changes with a well-formed message and push to the remote branch.

## Workflow

### 1. Verify prerequisites

```bash
git branch --show-current
git status --porcelain | grep "^[MARC]"
```

If no staged changes exist, tell the user "No staged changes found" and stop.

### 2. Analyze changes

```bash
git diff --cached --name-status
```

### 3. Create the commit message

Check for a project-specific template at `.github/commit-message-template`. If none exists, use conventional commits:

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

**Types**: feat, fix, docs, style, refactor, perf, test, build, ci, chore
**Description**: imperative mood, 50 chars max, capitalized, no trailing period
**Body**: optional, 72-char line wrap, explain what and why
**Footer**: breaking changes, issue references

If staged changes fall into multiple logical groups, create separate commits for each group.

### 4. Commit and push

```bash
git commit -m "<message>"
git log -1 --oneline
git push origin <current_branch>
```

### 5. Handle errors

- **Push rejected**: `git pull --rebase` then retry
- **Merge conflicts**: stop and tell the user to resolve conflicts first
- **Auth failure**: report the error

### 6. Report result

```json
{
  "commits_created": ["<hash>: <message>"],
  "branch_pushed": "<branch>",
  "status": "success|failed",
  "error_message": "<if failed>"
}
```
