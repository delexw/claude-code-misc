import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { JiraClient } from "./jira.js";
import { ticketKeys, type TicketAssignment, type RepoAssignment } from "./prioritizer.js";
import { type ForgeResult, type WorktreeInfo, worktreePath, buildForgePrompt } from "./prompts.js";

async function forgeInRepo(
  ticketKey: string,
  ticketUrl: string,
  assignment: RepoAssignment,
  devServerInfo: string,
  runner: ClaudeRunner,
  log: LogFn,
): Promise<{ ok: boolean; wt: WorktreeInfo | null }> {
  log(`  FORGING ${ticketKey} in ${assignment.repoPath} (worktree: ${assignment.branch})`);

  const { code, stdout } = await runner.run(buildForgePrompt(ticketKey, ticketUrl, devServerInfo), {
    cwd: assignment.repoPath,
    worktree: assignment.branch,
    taskName: `get-shit-done: forge ${ticketKey} in ${assignment.repoPath}`,
    model: "opus",
    effort: "low",
  });

  runner.writeLog("task", `${ticketKey}-${assignment.branch}`, stdout);

  if (code !== 0) {
    log(`  FORGE FAILED: ${ticketKey} in ${assignment.repoPath} (exit code: ${code})`);
    return { ok: false, wt: null };
  }

  return {
    ok: true,
    wt: {
      repoPath: assignment.repoPath,
      worktreePath: worktreePath(assignment.repoPath, assignment.branch),
    },
  };
}

export async function forgeTicket(
  ticket: TicketAssignment,
  devServerInfo: string,
  runner: ClaudeRunner,
  jira: JiraClient,
  log: LogFn,
): Promise<ForgeResult> {
  if (ticket.repos.length === 0) {
    throw new Error(
      `No repo assignments for ${ticket.key} — prioritizer must provide at least one`,
    );
  }
  for (const r of ticket.repos) {
    if (!r.branch) throw new Error(`No branch name for ${ticket.key} in ${r.repoPath}`);
  }

  const ticketUrl = jira.ticketUrl(ticket.key);
  log(`FORGING: ${ticket.key} -> ${ticketUrl} (${ticket.repos.length} repo(s))`);

  const results = await Promise.all(
    ticket.repos.map((r) => forgeInRepo(ticket.key, ticketUrl, r, devServerInfo, runner, log)),
  );

  const allOk = results.every((r) => r.ok);
  const worktrees: WorktreeInfo[] = results.flatMap((r) => (r.wt ? [r.wt] : []));

  if (!allOk) {
    log(`FORGE FAILED: ${ticket.key}`);
    return { ticketKey: ticket.key, status: "failed", worktrees: [] };
  }

  log(`FORGED: ${ticket.key}`);
  return { ticketKey: ticket.key, status: "success", worktrees };
}

export async function forgeGroup(
  group: TicketAssignment[],
  devServerInfo: string,
  runner: ClaudeRunner,
  jira: JiraClient,
  log: LogFn,
): Promise<ForgeResult[]> {
  log(`FORGING GROUP: ${ticketKeys(group).join(", ")}`);
  const results = await Promise.allSettled(
    group.map((t) => forgeTicket(t, devServerInfo, runner, jira, log)),
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          ticketKey: group[i].key,
          status: "failed",
          worktrees: [],
        },
  );
}
