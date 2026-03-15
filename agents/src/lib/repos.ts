import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const HOME = process.env.HOME!;

/**
 * Parse a comma-separated env var of repo paths.
 * Paths can be absolute or relative to $HOME.
 */
export function parseRepos(envVar: string): string[] {
  return (process.env[envVar] || "")
    .split(",")
    .filter(Boolean)
    .map((r) => (r.startsWith("/") ? r : join(HOME, r)));
}

/**
 * Expand repos to include git worktree directories.
 */
export function discoverRepos(baseRepos: string[]): Array<{ repo: string; baseRepo: string }> {
  const repos: Array<{ repo: string; baseRepo: string }> = [];
  for (const repo of baseRepos) {
    repos.push({ repo, baseRepo: repo });
    const worktreeDir = `${repo}-worktrees`;
    if (existsSync(worktreeDir)) {
      for (const entry of readdirSync(worktreeDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          repos.push({ repo: join(worktreeDir, entry.name), baseRepo: repo });
        }
      }
    }
  }
  return repos;
}

export function repoToSlug(path: string): string {
  return path.replace(/[/._\s]/g, "-");
}
