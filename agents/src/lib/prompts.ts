import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ForgeStatus = "success" | "failed";

export interface WorktreeInfo {
  repoPath: string;
  worktreePath: string;
}

export interface ForgeResult {
  ticketKey: string;
  status: ForgeStatus;
  worktrees: WorktreeInfo[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const AUTONOMY_PREFIX =
  "Autonomy mode: never use AskUserQuestion tool — explore answers yourself.";

// ─── Worktree helpers ────────────────────────────────────────────────────────

export function worktreePath(repoAbsPath: string, branch: string): string {
  return join(repoAbsPath, ".claude", "worktrees", branch);
}

// ─── Forge prompt ────────────────────────────────────────────────────────────

export function buildForgePrompt(
  ticketKey: string,
  ticketUrl: string,
  devServerInfo: string,
): string {
  const devCtx = devServerInfo ? `\nDev servers are already running: ${devServerInfo}` : "";

  return [
    `[GSD: forge ${ticketKey}] ${AUTONOMY_PREFIX}`,
    "",
    `Invoke Skill("/forge ${ticketUrl}${devCtx}'")`,
    "",
    "Report completion as plain text.",
  ].join("\n");
}

// ─── Merge prompt ────────────────────────────────────────────────────────────

export function buildMergePrompt(primaryTicket: string, worktreePaths: string[]): string {
  const worktrees = worktreePaths.map((wt) => `  ${wt}`).join("\n");

  return [
    `[GSD: merge ${primaryTicket}] ${AUTONOMY_PREFIX}`,
    "",
    "Worktrees to merge:",
    worktrees,
    "",
    "Steps:",
    `1. Create a merge branch from main (NOT from a worktree) named "${primaryTicket}-merge"`,
    "   (include a slug from the primary ticket title)",
    "2. Merge ALL worktree changes into the merge branch",
    "   (even if only one worktree — always merge to the merge branch):",
    "   - git merge or cherry-pick from each worktree branch",
    "   - Resolve any conflicts",
    "3. Verify the merged code compiles and has no obvious issues",
    "",
    "Return ONLY the merge branch name as plain text.",
  ].join("\n");
}

// ─── Verify prompt ───────────────────────────────────────────────────────────

export function buildVerifyPrompt(
  primaryTicket: string,
  devUrl: string,
  mergeBranch: string,
): string {
  return [
    `[GSD: verify ${primaryTicket}] ${AUTONOMY_PREFIX}`,
    "",
    `Dev servers are running at ${devUrl} on merge branch "${mergeBranch}" (started externally).`,
    `Ensure you are on the merge branch "${mergeBranch}" before verifying.`,
    "",
    `Run: Skill("/verification ${devUrl}")`,
    "",
    "Report the result as plain text.",
  ].join("\n");
}

// ─── PR prompt ───────────────────────────────────────────────────────────────

export function buildPrPrompt(forges: ForgeResult[]): string {
  let stepNum = 0;
  const steps = forges
    .flatMap((r) =>
      r.worktrees.map(
        (wt) =>
          `${++stepNum}. In worktree ${wt.worktreePath} (${r.ticketKey}):\n` +
          `   Skill("/git-commit") then Skill("/create-pr 'create a Draft PR and keep description concise'")`,
      ),
    )
    .join("\n");

  return [`[GSD: create PRs] ${AUTONOMY_PREFIX}`, "", steps].join("\n");
}
