// ─── Types ───────────────────────────────────────────────────────────────────

export type ForgeStatus = "success" | "failed";

export interface ForgeResult {
  ticketKey: string;
  status: ForgeStatus;
  worktreePath: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const AUTONOMY_PREFIX =
  "Autonomy mode: never use AskUserQuestion tool — explore answers yourself.";

// ─── JSON extraction ─────────────────────────────────────────────────────────

export function extractWorktreePath(stdout: string): string {
  try {
    const match = stdout.match(/\{[^{}]*"worktree_path"[^{}]*\}/);
    if (match) {
      const parsed: unknown = JSON.parse(match[0]);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "worktree_path" in parsed &&
        typeof parsed.worktree_path === "string"
      ) {
        return parsed.worktree_path;
      }
    }
  } catch {
    // ignore parse errors
  }
  return "";
}

// ─── Forge prompt ────────────────────────────────────────────────────────────

export function buildForgePrompt(
  ticketKey: string,
  ticketUrl: string,
  repos: string[],
  devServerInfo: string,
): string {
  const repoList = repos.join("\n");
  const devCtx = devServerInfo ? `\nDev servers are already running: ${devServerInfo}` : "";

  return [
    `[GSD: forge ${ticketKey}] ${AUTONOMY_PREFIX}`,
    "",
    `Invoke Skill("/forge ${ticketUrl} 'Find the correct repo from:`,
    repoList,
    `Multiple repos are possible.${devCtx}'")`,
    "",
    "Return the JSON output from forge ONLY without code fence.",
  ].join("\n");
}

// ─── Merge prompt ────────────────────────────────────────────────────────────

export function buildMergePrompt(primaryTicket: string, forges: ForgeResult[]): string {
  const worktrees = forges.map((r) => `  ${r.ticketKey}: ${r.worktreePath}`).join("\n");

  return [
    `[GSD: merge ${primaryTicket}] ${AUTONOMY_PREFIX}`,
    "",
    "Forge results (ticket: worktree_path):",
    worktrees,
    "",
    "Steps:",
    `1. Create a merge branch from main named "${primaryTicket}-merge"`,
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

export function buildVerifyPrompt(primaryTicket: string, devUrl: string): string {
  return [
    `[GSD: verify ${primaryTicket}] ${AUTONOMY_PREFIX}`,
    "",
    `Dev servers are running at ${devUrl} (started externally).`,
    "",
    `Run: Skill("/verification ${devUrl}")`,
    "",
    "Report the result as plain text.",
  ].join("\n");
}

// ─── PR prompt ───────────────────────────────────────────────────────────────

export function buildPrPrompt(forges: ForgeResult[]): string {
  const steps = forges
    .map(
      (r, i) =>
        `${i + 1}. In worktree ${r.worktreePath}:\n` +
        `   Skill("/git-commit") then Skill("/create-pr 'create a Draft PR and keep description concise'")`,
    )
    .join("\n");

  return [`[GSD: create PRs] ${AUTONOMY_PREFIX}`, "", steps].join("\n");
}
