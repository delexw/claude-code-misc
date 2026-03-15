---
name: create-pr
description: Create a GitHub pull request from the current branch. Analyzes code changes, generates a descriptive PR title and body using the project's PR template, and runs `gh pr create`. Use when the user says "create PR", "open a PR", "make a pull request", "submit PR", "PR this", "send for review", or wants to open a pull request for their current branch. Also triggers when the user has finished committing and wants to get their changes reviewed.
allowed-tools: Read, Bash, Glob, Grep
---

# Create GitHub Pull Request

Analyze code changes on the current branch and create a well-structured pull request using `gh`.

## Workflow

### 1. Verify prerequisites

Check that you're in a git repo, on a feature branch (not main/master), and that `gh` is authenticated:

```bash
git rev-parse --is-inside-work-tree
git branch --show-current
gh auth status
```

If any check fails, report the specific error and stop.

### 2. Check for existing PRs

Before creating a new PR, check if one already exists for this branch:

```bash
gh pr list --head "$(git branch --show-current)" --state all --json number,title,state,url
```

- **If an open PR exists**: report the existing PR URL and stop — do not create a duplicate.
- **If a merged PR exists**: proceed to create a new PR (the user has new changes to submit).
- **If a closed (not merged) PR exists**: proceed to create a new PR.
- **If no PR exists**: proceed normally.

### 3. Gather change context

```bash
git log --oneline main..HEAD   # or master..HEAD
git diff main..HEAD --stat
git diff main..HEAD
```

Identify the base branch automatically — try `main`, then `master`, then the default branch from `gh repo view --json defaultBranchRef`.

### 4. Categorize changes

Group the diff into:
- **Features**: new functionality
- **Fixes**: bug corrections with issue references
- **Refactoring**: code improvements without behavior changes
- **Dependencies**: package updates with version numbers

Note modified files, functions/classes affected, and import changes.

### 5. Generate PR content

Look for `.github/PULL_REQUEST_TEMPLATE.md` in the project root. If found, use it as the PR body template and fill in every section with actual content from the diff analysis. If no template exists, write a clear description covering what changed and why.

**PR title format**: `[TICKET-ID]: brief description` (max 80 chars). The ticket ID **must** be the very first element in the title. Extract the ticket ID from the branch name or commit messages. Example: `[EC-1111]: Fix item license search query`. Do NOT place conventional prefixes (`feat:`, `fix:`, etc.) before the ticket ID.

### 6. Create the PR

```bash
gh pr create --title "<title>" --body "<body>" --draft
```

Then open it in the browser:
```bash
gh pr view --web
```

### 7. Report result

Return ONLY this JSON (no other text before or after):

```json
{
  "pr_url": "<full GitHub PR URL>",
  "pr_number": <number>,
  "title": "<PR title>",
  "status": "success"
}
```

On failure:

```json
{
  "pr_url": "",
  "pr_number": 0,
  "title": "",
  "status": "failed",
  "error_message": "<what went wrong>"
}
```

## Error handling

- **No git repo**: "Not in a git repository. Run from a project root."
- **No changes**: "No commits found ahead of the base branch."
- **gh not installed/authed**: "Install GitHub CLI and run `gh auth login`."
- **Push rejected**: push the branch first, then retry PR creation.
