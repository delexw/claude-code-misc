import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { DevServerManager } from "./dev-servers.js";
import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";
import type { GroupedLayer } from "./prioritizer.js";
import type { ForgeResult } from "./prompts.js";
import { buildMergePrompt, buildVerifyPrompt, buildPrPrompt } from "./prompts.js";
import { filterGroup } from "./prioritizer.js";
import { forgeGroup } from "./forge.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GroupResult {
  succeeded: string[];
  failed: string[];
}

// ─── Merge + Verify + PR ─────────────────────────────────────────────────────

export async function mergeAndVerify(
  forges: ForgeResult[],
  group: string[],
  repos: string[],
  hasFrontend: boolean,
  runner: ClaudeRunner,
  devServers: DevServerManager,
  jira: JiraClient,
  tracker: ProcessedTracker,
  log: LogFn,
): Promise<GroupResult> {
  const successful = forges.filter((r) => r.status === "success" && r.worktreePath);
  const failedKeys = forges.filter((r) => r.status !== "success").map((r) => r.ticketKey);

  if (successful.length === 0) {
    log(`GROUP FAILED: no successful forges for ${group.join(", ")}`);
    return { succeeded: [], failed: group };
  }

  const primaryTicket = group[0];

  // Step 1: Merge
  log(`MERGING: ${primaryTicket} (${successful.length} ticket(s))`);
  const { code: mergeCode, stdout: mergeOut } = await runner.run(
    buildMergePrompt(primaryTicket, successful),
    { repos, taskName: `get-shit-done: merge ${primaryTicket}` },
  );
  runner.writeLog("merge", primaryTicket, mergeOut);

  if (mergeCode !== 0) {
    log(`MERGE FAILED: ${primaryTicket} (exit code: ${mergeCode})`);
    return {
      succeeded: [],
      failed: [...failedKeys, ...successful.map((r) => r.ticketKey)],
    };
  }

  // Step 2: Restart servers on merge branch
  const mergeBranch = mergeOut.trim().split("\n").pop()?.trim() || "";
  log(`MERGE BRANCH: ${mergeBranch}`);

  if (hasFrontend && mergeBranch) {
    await devServers.restartOnBranch(mergeBranch);
  }

  // Step 3: Verify
  if (hasFrontend) {
    log(`VERIFYING: ${primaryTicket}`);
    const { code: verifyCode, stdout: verifyOut } = await runner.run(
      buildVerifyPrompt(primaryTicket, devServers.devUrl, mergeBranch),
      { repos, taskName: `get-shit-done: verify ${primaryTicket}` },
    );
    runner.writeLog("verify", primaryTicket, verifyOut);

    if (verifyCode !== 0) {
      log(`VERIFY FAILED: ${primaryTicket} (exit code: ${verifyCode})`);
    }
  }

  // Step 4: Create PRs
  log(`CREATING PRs: ${primaryTicket}`);
  const { code: prCode, stdout: prOut } = await runner.run(buildPrPrompt(successful), {
    repos,
    taskName: `get-shit-done: pr ${primaryTicket}`,
  });
  runner.writeLog("pr", primaryTicket, prOut);

  if (prCode !== 0) {
    log(`PR CREATION FAILED: ${primaryTicket}`);
  }

  // Step 5: Update JIRA
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
  group: string[],
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
  const forgeResults = await forgeGroup(group, repos, devServerInfo, runner, jira, log);
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

    log(`Layer ${i}: [${group.join(", ")}]${layer.relation ? ` (${layer.relation})` : ""}`);

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
