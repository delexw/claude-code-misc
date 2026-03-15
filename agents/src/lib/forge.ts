import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { JiraClient } from "./jira.js";
import {
  type ForgeResult,
  type ForgeStatus,
  extractWorktreePath,
  buildForgePrompt,
} from "./prompts.js";

export async function forgeTicket(
  ticketKey: string,
  repos: string[],
  devServerInfo: string,
  runner: ClaudeRunner,
  jira: JiraClient,
  log: LogFn,
): Promise<ForgeResult> {
  const ticketUrl = jira.ticketUrl(ticketKey);
  log(`FORGING: ${ticketKey} -> ${ticketUrl}`);

  const { code, stdout } = await runner.run(
    buildForgePrompt(ticketKey, ticketUrl, repos, devServerInfo),
    {
      repos,
      taskName: `get-shit-done: forge ${ticketKey}`,
      model: "opus",
      effort: "low",
    },
  );

  runner.writeLog("task", ticketKey, stdout);

  if (code !== 0) {
    log(`FORGE FAILED: ${ticketKey} (exit code: ${code})`);
    return { ticketKey, status: "failed", worktreePath: "" };
  }

  log(`FORGED: ${ticketKey}`);
  return {
    ticketKey,
    status: "success",
    worktreePath: extractWorktreePath(stdout),
  };
}

export async function forgeGroup(
  group: string[],
  repos: string[],
  devServerInfo: string,
  runner: ClaudeRunner,
  jira: JiraClient,
  log: LogFn,
): Promise<ForgeResult[]> {
  log(`FORGING GROUP: ${group.join(", ")}`);
  const results = await Promise.allSettled(
    group.map((t) => forgeTicket(t, repos, devServerInfo, runner, jira, log)),
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          ticketKey: group[i],
          status: "failed" as ForgeStatus,
          worktreePath: "",
        },
  );
}
