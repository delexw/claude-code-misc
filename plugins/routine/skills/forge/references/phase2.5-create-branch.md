# Phase 2.5: Create Git Branch

- Read `SKILL_DIR/domains.json` for the ticket summary, and `SKILL_DIR/jira/output.json` for the ticket title
- Using the ticket ID and ticket title:
  - Slugify the ticket title: lowercase, replace spaces and special characters with hyphens, collapse consecutive hyphens, strip leading/trailing hyphens, truncate to 50 characters
  - Compose branch name: `{ticket_id}-{slugified_title}` (e.g. `EC-1234-fix-payment-checkout-bug`)
- Determine the working repo directory:
  1. If `$ARGUMENTS[1]` is provided, read it and use your judgment to infer the intended repo path (it may name a project, describe a service, reference a directory, or give any other hint — resolve it to an absolute path on disk)
  2. Else if the current directory is a git repo (`git rev-parse --is-inside-work-tree` succeeds), use the current directory
  3. Otherwise, skip this phase entirely — log "No git repo found, skipping branch creation" and continue to Phase 3
- Run the script: `bash ${CLAUDE_SKILL_DIR}/scripts/create-branch.sh {branch_name} {repo_dir}`
  - The script fetches `origin/main` without checking out main — safe for parallel forge runs
  - It creates the worktree branched from `origin/main` (not local main)
  - It copies `.env*` files from the main worktree into the new worktree
  - It runs `scripts/uptodate.sh` inside the new worktree (not the main worktree) to install dependencies
- The script prints the worktree path to stdout. Capture it and `cd` into it so all subsequent phases operate in the worktree
- If the script encounters an error it will print a warning and continue — do not abort the skill

## Parallel safety notes

When multiple forge skills run concurrently, each creates its own worktree. The script is designed to avoid conflicts:
- **No main checkout**: Uses `origin/main` ref directly — no mutation of the main worktree's working directory
- **Isolated provisioning**: `uptodate.sh` runs inside each worktree, not the shared main worktree
- **Env file copying**: Each worktree gets its own copy of `.env*` files
- **Git fetch locking**: `git fetch` has built-in locking, so concurrent fetches are safe
