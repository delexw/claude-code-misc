import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { JiraClient } from "./jira.js";
import { ticketKeys, type TicketAssignment, type RepoAssignment } from "./prioritizer.js";
import { type ForgeResult, type WorktreeInfo, worktreePath, buildForgePrompt } from "./prompts.js";

// ─── ForgeService deps ──────────────────────────────────────────────────────

export interface ForgeServiceDeps {
  runner: ClaudeRunner;
  jira: JiraClient;
  log: LogFn;
}

// ─── ForgeService class ─────────────────────────────────────────────────────

export class ForgeService {
  private readonly runner: ClaudeRunner;
  private readonly jira: JiraClient;
  private readonly log: LogFn;

  constructor(deps: ForgeServiceDeps) {
    this.runner = deps.runner;
    this.jira = deps.jira;
    this.log = deps.log;
  }

  private async forgeInRepo(
    ticketKey: string,
    ticketUrl: string,
    assignment: RepoAssignment,
    devServerInfo: string,
  ): Promise<{ ok: boolean; wt: WorktreeInfo | null }> {
    this.log(`  FORGING ${ticketKey} in ${assignment.repoPath} (worktree: ${assignment.branch})`);

    const { code, stdout } = await this.runner.run(
      buildForgePrompt(ticketKey, ticketUrl, devServerInfo),
      {
        cwd: assignment.repoPath,
        worktree: assignment.branch,
        taskName: `get-shit-done: forge ${ticketKey} in ${assignment.repoPath}`,
        model: "opus",
        effort: "low",
      },
    );

    this.runner.writeLog("task", `${ticketKey}-${assignment.branch}`, stdout);

    if (code !== 0) {
      this.log(`  FORGE FAILED: ${ticketKey} in ${assignment.repoPath} (exit code: ${code})`);
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

  async forgeTicket(ticket: TicketAssignment, devServerInfo: string): Promise<ForgeResult> {
    if (ticket.repos.length === 0) {
      throw new Error(
        `No repo assignments for ${ticket.key} — prioritizer must provide at least one`,
      );
    }
    for (const r of ticket.repos) {
      if (!r.branch) throw new Error(`No branch name for ${ticket.key} in ${r.repoPath}`);
    }

    const ticketUrl = this.jira.ticketUrl(ticket.key);
    this.log(`FORGING: ${ticket.key} -> ${ticketUrl} (${ticket.repos.length} repo(s))`);

    const results = await Promise.all(
      ticket.repos.map((r) => this.forgeInRepo(ticket.key, ticketUrl, r, devServerInfo)),
    );

    const worktrees: WorktreeInfo[] = results.flatMap((r) => (r.wt ? [r.wt] : []));
    const allOk = results.every((r) => r.ok);
    const noneOk = worktrees.length === 0;

    if (noneOk) {
      this.log(`FORGE FAILED: ${ticket.key}`);
      return { ticketKey: ticket.key, status: "failed", worktrees: [] };
    }

    const status = allOk ? "success" : "partial";
    this.log(`FORGED (${status}): ${ticket.key}`);
    return { ticketKey: ticket.key, status, worktrees };
  }

  async forgeGroup(group: TicketAssignment[], devServerInfo: string): Promise<ForgeResult[]> {
    this.log(`FORGING GROUP: ${ticketKeys(group).join(", ")}`);
    const results = await Promise.allSettled(
      group.map((t) => this.forgeTicket(t, devServerInfo)),
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
}

