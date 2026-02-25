#!/usr/bin/env bash
# create-branch.sh — Create a feature branch from latest main
#
# Usage: create-branch.sh <branch-name>
#
# Steps:
#   1. Stash any uncommitted changes
#   2. Switch to main and pull latest
#   3. Create and checkout the new branch
#   4. Pop stash if one was created

set -euo pipefail

BRANCH="${1:-}"

if [[ -z "$BRANCH" ]]; then
  echo "Usage: create-branch.sh <branch-name>" >&2
  exit 1
fi

# Determine main branch name (main or master)
MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")

# Stash if there are uncommitted changes
STASHED=false
if ! git diff --quiet || ! git diff --cached --quiet; then
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
