import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ForgeStatus = "success" | "partial" | "failed";

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

export function buildMergePrompt(
  primaryTicket: string,
  worktreePaths: string[],
  baseBranch?: string,
): string {
  const worktrees = worktreePaths.map((wt) => `  ${wt}`).join("\n");
  const base = baseBranch ?? "main";
  const stackedNote = baseBranch
    ? [
        "",
        `IMPORTANT: This is a stacked merge. The base branch "${baseBranch}" contains changes from a prior layer`,
        "that the worktrees were NOT aware of (they were forked from main). Expect conflicts or overlapping",
        "edits — resolve them so that both the prior layer's changes and this layer's changes work together.",
      ].join("\n")
    : "";

  return [
    `[GSD: merge ${primaryTicket}] ${AUTONOMY_PREFIX}`,
    "",
    "Worktrees to merge:",
    worktrees,
    stackedNote,
    "",
    "Steps:",
    `1. Create a merge branch from "${base}" (NOT from a worktree) named "${primaryTicket}-merge-{slug}"`,
    `   e.g. "${primaryTicket}-merge-add-team-tabs" (slug from primary ticket title, lowercase, hyphens)`,
    "2. Run: entire enable -f --local --agent claude-code",
    "3. Merge ALL worktree changes into the merge branch",
    "   (even if only one worktree — always merge to the merge branch):",
    "   - git merge or cherry-pick from each worktree branch",
    "   - Resolve any conflicts",
    "4. Verify the merged code compiles and has no obvious issues",
    "",
    "Return ONLY the merge branch name as plain text.",
  ].join("\n");
}

// ─── Verify prompt ───────────────────────────────────────────────────────────

export function buildVerifyPrompt(
  primaryTicket: string,
  devUrl: string,
  mergeBranch: string,
  verification: { required: boolean; reason: string },
): string {
  const devCtx = devUrl
    ? `Dev servers are running at ${devUrl} on merge branch "${mergeBranch}" (started externally).`
    : `No dev servers running (UI verification not required).`;

  return [
    `[GSD: verify ${primaryTicket}] ${AUTONOMY_PREFIX}`,
    "",
    devCtx,
    `Ensure you are on the merge branch "${mergeBranch}" before verifying.`,
    "",
    `Verification context:`,
    `- Web UI verification required: ${verification.required}`,
    `- Reason: ${verification.reason}`,
    "",
    `Run: Skill("/verification${devUrl ? ` ${devUrl}` : ""}")`,
    "",
    "Report the result as plain text.",
  ].join("\n");
}

// ─── Commit prompt ──────────────────────────────────────────────────────────

export function buildCommitPrompt(ticketKey: string): string {
  return [
    `[GSD: commit ${ticketKey}] ${AUTONOMY_PREFIX}`,
    "",
    `Commit only ticket-related code changes in this worktree for ${ticketKey}.`,
    "",
    "Before committing, discard any test artifacts that should not be committed:",
    "  git checkout -- '**/*.png' '**/*.jpg' '**/*.jpeg' '**/*.webp' '**/*.gif'",
    "  git checkout -- '**/screenshots/**' '**/test-results/**' '**/playwright-report/**'",
    "Only stage and commit source code, tests, configs, and documentation.",
    "",
    `Skill("/git-commit")`,
  ].join("\n");
}

// ─── PR prompt ───────────────────────────────────────────────────────────────

export interface PrDependency {
  baseBranch: string;
  prUrl: string;
}

export function buildPrPrompt(
  ticketKeys: string[],
  mergeBranch: string,
  dependency?: PrDependency,
  _screenshots?: string[],
): string {
  const tickets = ticketKeys.join(", ");
  const base = dependency?.baseBranch ?? "main";
  const depNote = dependency
    ? `\n\nThis is a stacked PR. Set the PR base branch to "${dependency.baseBranch}" (not main). Add to the PR description: "Depends on ${dependency.prUrl} — merge that first."`
    : "";

  return [
    `[GSD: create PR for ${tickets}] ${AUTONOMY_PREFIX}`,
    "",
    `You are on merge branch "${mergeBranch}" with all changes already committed and merged.`,
    `The base branch is "${base}".${depNote}`,
    `Skill("/create-pr 'create a Draft PR and keep description concise'")`,
  ].join("\n");
}
