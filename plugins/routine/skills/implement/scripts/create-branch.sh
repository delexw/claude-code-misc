#!/usr/bin/env bash
# create-branch.sh — Create a git worktree from latest main for a skill run
#
# Usage: create-branch.sh <branch-name> [repo-dir]
#
# Steps:
#   1. Resolve repo root from repo-dir (defaults to current directory)
#   2. Pull latest main in the main worktree
#   3. Create a new branch off main
#   4. Add a git worktree at <repo-root>/../<repo-name>-worktrees/<branch-name>
#   5. Print the worktree path to stdout (for the caller to capture)

BRANCH="${1:-}"
REPO_DIR="${2:-.}"

if [[ -z "$BRANCH" ]]; then
  echo "Usage: create-branch.sh <branch-name> [repo-dir]" >&2
  exit 1
fi

{
  cd "$REPO_DIR" || { echo "ERROR: cannot cd into '$REPO_DIR'" >&2; exit 1; }

  # Verify this is a git repo
  if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "ERROR: '$REPO_DIR' is not a git repository" >&2
    exit 1
  fi

  REPO_ROOT=$(git rev-parse --show-toplevel)
  REPO_NAME=$(basename "$REPO_ROOT")

  # Determine main branch name
  MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
  MAIN="${MAIN:-main}"

  # Pull latest main (from the main worktree)
  echo "Pulling latest '$MAIN'..." >&2
  git fetch origin "$MAIN"
  git fetch origin "$MAIN":"$MAIN" 2>/dev/null || true

  # Worktree destination: sibling directory of the repo
  WORKTREE_BASE="$(dirname "$REPO_ROOT")/${REPO_NAME}-worktrees"
  WORKTREE_PATH="${WORKTREE_BASE}/${BRANCH}"

  # Remove stale worktree entry if the directory no longer exists
  if git worktree list --porcelain | grep -q "worktree ${WORKTREE_PATH}$" && [[ ! -d "$WORKTREE_PATH" ]]; then
    echo "Pruning stale worktree entry for '$WORKTREE_PATH'..." >&2
    git worktree prune
  fi

  # Create worktree
  if [[ -d "$WORKTREE_PATH" ]]; then
    echo "Worktree already exists at '$WORKTREE_PATH'" >&2
  else
    mkdir -p "$WORKTREE_BASE"
    if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
      echo "Branch '$BRANCH' already exists — adding worktree..." >&2
      git worktree add "$WORKTREE_PATH" "$BRANCH"
    else
      echo "Creating branch '$BRANCH' and adding worktree..." >&2
      git worktree add -b "$BRANCH" "$WORKTREE_PATH" "$MAIN"
    fi
  fi

  echo "Worktree ready: $WORKTREE_PATH" >&2

  # Output the worktree path to stdout for the caller to capture and cd into
  echo "$WORKTREE_PATH"

} || {
  echo "WARNING: create-branch.sh encountered an error — skipping worktree creation" >&2
}
