import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { DevServerManager } from "./dev-servers.js";
import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";
import type { GroupedLayer, TicketAssignment } from "./prioritizer.js";
import type { ForgeResult } from "./prompts.js";
import {
  buildCommitPrompt,
  buildMergePrompt,
  buildVerifyPrompt,
  buildPrPrompt,
} from "./prompts.js";
import { filterGroup, ticketKeys } from "./prioritizer.js";
import { forgeGroup } from "./forge.js";

/**
 * Group worktree infos by their repo root path.
 */
function groupWorktreesByRepo(forges: ForgeResult[]): Map<string, string[]> {
  const byRepo = new Map<string, string[]>();
  for (const forge of forges) {
    for (const wt of forge.worktrees) {
      const paths = byRepo.get(wt.repoPath) ?? [];
      paths.push(wt.worktreePath);
      byRepo.set(wt.repoPath, paths);
    }
  }
  return byRepo;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface GroupResult {
  succeeded: string[];
  failed: string[];
}

// ─── Merge + Verify + PR ─────────────────────────────────────────────────────

export async function mergeAndVerify(
  forges: ForgeResult[],
  group: TicketAssignment[],
  repos: string[],
  hasFrontend: boolean,
  runner: ClaudeRunner,
  devServers: DevServerManager,
  jira: JiraClient,
  tracker: ProcessedTracker,
  log: LogFn,
): Promise<GroupResult> {
  const keys = ticketKeys(group);
  const successful = forges.filter((r) => r.status === "success" && r.worktrees.length > 0);
  const failedKeys = forges.filter((r) => r.status !== "success").map((r) => r.ticketKey);

  if (successful.length === 0) {
    log(`GROUP FAILED: no successful forges for ${keys.join(", ")}`);
    return { succeeded: [], failed: keys };
  }

  const primaryTicket = keys[0];

  // Step 1: Commit each worktree (continue from forge session)
  log(`COMMITTING: ${primaryTicket} (${successful.length} ticket(s))`);
  await Promise.all(
    successful.flatMap((forge) =>
      forge.worktrees.map(async (wt) => {
        const { code, stdout } = await runner.run(buildCommitPrompt(forge.ticketKey), {
          cwd: wt.worktreePath,
          continueSession: true,
          taskName: `get-shit-done: commit ${forge.ticketKey}`,
        });
        runner.writeLog("commit", forge.ticketKey, stdout);
        if (code !== 0)
          log(`COMMIT WARN: ${forge.ticketKey} in ${wt.worktreePath} (exit code: ${code})`);
      }),
    ),
  );

  // Step 2: Merge committed worktrees per repo in parallel
  const worktreesByRepo = groupWorktreesByRepo(successful);
  log(`MERGING: ${primaryTicket} across ${worktreesByRepo.size} repo(s)`);

  const mergeResults = await Promise.all(
    [...worktreesByRepo.entries()].map(async ([repoRoot, wtPaths]) => {
      const { code, stdout } = await runner.run(buildMergePrompt(primaryTicket, wtPaths), {
        cwd: repoRoot,
        taskName: `get-shit-done: merge ${primaryTicket} in ${repoRoot}`,
      });
      runner.writeLog("merge", primaryTicket, stdout);
      const branch = stdout.trim().split("\n").pop()?.trim() || "";
      return { repoRoot, code, branch };
    }),
  );

  const mergedBranches = mergeResults.filter((r) => r.code === 0 && r.branch);
  if (mergedBranches.length === 0) {
    log(`MERGE FAILED: ${primaryTicket} — all repos failed or produced empty branch names`);
    return {
      succeeded: [],
      failed: [...failedKeys, ...successful.map((r) => r.ticketKey)],
    };
  }
  for (const r of mergeResults) {
    if (r.code !== 0) log(`MERGE FAILED: ${primaryTicket} in ${r.repoRoot}`);
    else if (!r.branch) log(`MERGE WARN: ${primaryTicket} in ${r.repoRoot} — empty branch name`);
  }

  // Step 3: Restart servers on first merge branch
  const mergeBranch = mergedBranches[0].branch;
  log(`MERGE BRANCH: ${mergeBranch}`);

  if (hasFrontend) {
    await devServers.restartOnBranch(mergeBranch);
  }

  // Step 4: Verify
  if (hasFrontend) {
    log(`VERIFYING: ${primaryTicket}`);
    const { code: verifyCode, stdout: verifyOut } = await runner.run(
      buildVerifyPrompt(primaryTicket, devServers.devUrl, mergeBranch),
      {
        cwd: mergedBranches[0].repoRoot,
        continueSession: true,
        taskName: `get-shit-done: verify ${primaryTicket}`,
      },
    );
    runner.writeLog("verify", primaryTicket, verifyOut);

    if (verifyCode !== 0) {
      log(`VERIFY FAILED: ${primaryTicket} (exit code: ${verifyCode})`);
    }
  }

  // Step 5: Create PRs per repo (continue from forge session for full context)
  const succeededKeys = successful.map((r) => r.ticketKey);
  await Promise.all(
    mergedBranches.map(async (mb) => {
      log(`CREATING PR: ${primaryTicket} in ${mb.repoRoot}`);
      const { code: prCode, stdout: prOut } = await runner.run(
        buildPrPrompt(succeededKeys, mb.branch),
        {
          cwd: mb.repoRoot,
          continueSession: true,
          taskName: `get-shit-done: pr ${primaryTicket} in ${mb.repoRoot}`,
        },
      );
      runner.writeLog("pr", primaryTicket, prOut);
      if (prCode !== 0) log(`PR CREATION FAILED: ${primaryTicket} in ${mb.repoRoot}`);
    }),
  );

  // Step 6: Update JIRA
  await Promise.all(
    successful.map(async (r) => {
      log(`SUCCESS: ${r.ticketKey}`);
      const moved = await jira.moveTicket(r.ticketKey, "In Progress");
      if (!moved) log(`WARN: Could not move ${r.ticketKey} to In Progress`);
      tracker.mark(r.ticketKey);
      return r;
    }),
  );

  return {
    succeeded: successful.map((r) => r.ticketKey),
    failed: failedKeys,
  };
}

// ─── Group processing (forge → merge → verify → PR) ─────────────────────────

export async function processGroup(
  group: TicketAssignment[],
  repos: string[],
  hasFrontend: boolean,
  runner: ClaudeRunner,
  devServers: DevServerManager,
  jira: JiraClient,
  tracker: ProcessedTracker,
  log: LogFn,
): Promise<GroupResult> {
  if (hasFrontend) await devServers.startAll();

  const devServerInfo = hasFrontend ? devServers.devUrl : "";
  const forgeResults = await forgeGroup(group, devServerInfo, runner, jira, log);
  const result = await mergeAndVerify(
    forgeResults,
    group,
    repos,
    hasFrontend,
    runner,
    devServers,
    jira,
    tracker,
    log,
  );

  if (hasFrontend) devServers.stopAll();

  return result;
}

// ─── Process layers (dependency order) ───────────────────────────────────────

export async function processLayers(
  layers: GroupedLayer[],
  unprocessedSet: Set<string>,
  skippedKeys: Set<string>,
  excludedKeys: Set<string>,
  repos: string[],
  runner: ClaudeRunner,
  devServers: DevServerManager,
  jira: JiraClient,
  tracker: ProcessedTracker,
  log: LogFn,
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  /* oxlint-disable no-await-in-loop -- layers are sequential; each depends on the prior layer */
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const group = filterGroup(layer.group, unprocessedSet, skippedKeys, excludedKeys);
    if (group.length === 0) continue;

    log(
      `Layer ${i}: [${ticketKeys(group).join(", ")}]${layer.relation ? ` (${layer.relation})` : ""}`,
    );

    const result = await processGroup(
      group,
      repos,
      layer.hasFrontend,
      runner,
      devServers,
      jira,
      tracker,
      log,
    );
    succeeded += result.succeeded.length;
    failed += result.failed.length;
  }

  /* oxlint-enable no-await-in-loop */

  return { succeeded, failed };
}
