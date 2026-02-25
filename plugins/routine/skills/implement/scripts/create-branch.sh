#!/usr/bin/env bash
# create-branch.sh — Create a feature branch from latest main
#
# Usage: create-branch.sh <branch-name> [repo-dir]
#
# Steps:
#   1. cd into repo-dir (defaults to current directory)
#   2. Stash any uncommitted changes
#   3. Switch to main and pull latest
#   4. Create and checkout the new branch
#   5. Pop stash if one was created

BRANCH="${1:-}"
REPO_DIR="${2:-.}"

if [[ -z "$BRANCH" ]]; then
  echo "Usage: create-branch.sh <branch-name> [repo-dir]" >&2
  exit 1
fi

{
  cd "$REPO_DIR" || { echo "ERROR: cannot cd into '$REPO_DIR'" >&2; exit 1; }

  # Verify this is actually a git repo
  if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "ERROR: '$REPO_DIR' is not a git repository" >&2
    exit 1
  fi

  # Determine main branch name
  MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
  MAIN="${MAIN:-main}"

  # Stash if there are uncommitted changes
  STASHED=false
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo "Stashing uncommitted changes..."
    git stash push -m "implement-skill: stash before branch creation"
    STASHED=true
  fi

  # Switch to main and pull
  echo "Switching to '$MAIN' and pulling latest..."
  git checkout "$MAIN"
  git pull origin "$MAIN"

  # Create or checkout the target branch
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "Branch '$BRANCH' already exists — checking out..."
    git checkout "$BRANCH"
  else
    echo "Creating branch '$BRANCH'..."
    git checkout -b "$BRANCH"
  fi

  # Restore stash
  if [[ "$STASHED" == true ]]; then
    echo "Restoring stashed changes..."
    git stash pop
  fi

  echo "Ready on branch: $(git rev-parse --abbrev-ref HEAD)"
} || {
  echo "WARNING: create-branch.sh encountered an error — skipping branch creation" >&2
  exit 0
}
