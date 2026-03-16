import { execSync } from "node:child_process";
import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { DevServerManager } from "./dev-servers.js";
import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";
import type { GroupedLayer, TicketAssignment, Verification } from "./prioritizer.js";
import type { ForgeResult, PrDependency } from "./prompts.js";
import {
  buildCommitPrompt,
  buildMergePrompt,
  buildVerifyPrompt,
  buildPrPrompt,
} from "./prompts.js";
import { filterGroup, primaryKey, ticketKeys } from "./prioritizer.js";
import { parseJson } from "./json.js";
import { forgeGroup } from "./forge.js";
import type { RunState } from "./run-state.js";

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

/** Map from repo root path → a string value (branch name, PR URL, etc.). */
export type RepoMap = Map<string, string>;

/** Combined per-repo state carried between groups. */
export interface LayerState {
  branches: RepoMap;
  prUrls: RepoMap;
}

/** Per-group state map, keyed by the group's primary ticket key. */
export type GroupStates = Map<string, LayerState>;

function emptyState(): LayerState {
  return { branches: new Map(), prUrls: new Map() };
}

/**
 * Build a lookup from any ticket key to its group's primary key.
 * Allows dependsOn to reference any ticket in a group, not just the primary.
 */
export function buildTicketToGroupMap(layers: GroupedLayer[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const layer of layers) {
    const pk = primaryKey(layer);
    for (const ticket of layer.group) {
      map.set(ticket.key, pk);
    }
  }
  return map;
}

/** Resolve the parent state for a group based on its dependsOn reference. */
export function resolveParentState(
  dependsOn: string | null,
  groupStates: GroupStates,
  failedGroups: Set<string>,
  ticketToGroup: Map<string, string>,
  log: LogFn,
): LayerState | "skip" {
  if (!dependsOn) return emptyState();

  // Resolve ticket key → group primary key (dependsOn may reference any ticket in a group)
  const groupKey = ticketToGroup.get(dependsOn) ?? dependsOn;

  if (failedGroups.has(groupKey)) {
    log(`SKIP: dependency ${dependsOn} (group ${groupKey}) failed — skipping downstream group`);
    return "skip";
  }
  const parent = groupStates.get(groupKey);
  if (!parent) {
    log(`WARN: dependency ${dependsOn} (group ${groupKey}) not found in group states — branching from main`);
    return emptyState();
  }
  return parent;
}

interface GroupResult {
  succeeded: string[];
  failed: string[];
  /** Per-repo state produced by this group (branches + PR URLs). */
  layerState: LayerState;
}

// ─── PR output parsing ──────────────────────────────────────────────────────

interface VerifyOutput {
  status: "passed" | "fixed" | "skipped";
  summary: string;
  screenshots?: string[];
}

function isVerifyOutput(v: unknown): v is VerifyOutput {
  return (
    typeof v === "object" &&
    v !== null &&
    "status" in v &&
    typeof v.status === "string" &&
    ["passed", "fixed", "skipped"].includes(v.status) &&
    "summary" in v &&
    typeof v.summary === "string"
  );
}

interface PrOutput {
  pr_url: string;
  status: "success";
}

function isPrOutput(v: unknown): v is PrOutput {
  return (
    typeof v === "object" &&
    v !== null &&
    "status" in v &&
    v.status === "success" &&
    "pr_url" in v &&
    typeof v.pr_url === "string"
  );
}

/** Extract pr_url from the create-pr skill's JSON output. */
function parsePrUrl(stdout: string): string {
  return parseJson(stdout, isPrOutput)?.pr_url ?? "";
}

// ─── Merge + Verify + PR ─────────────────────────────────────────────────────

export async function mergeAndVerify(
  forges: ForgeResult[],
  group: TicketAssignment[],
  repos: string[],
  verification: Verification,
  prevState: LayerState,
  runner: ClaudeRunner,
  devServers: DevServerManager,
  jira: JiraClient,
  tracker: ProcessedTracker,
  log: LogFn,
): Promise<GroupResult> {
  const keys = ticketKeys(group);
  const successful = forges.filter((r) => r.status !== "failed" && r.worktrees.length > 0);
  const failedKeys = forges.filter((r) => r.status === "failed").map((r) => r.ticketKey);

  if (successful.length === 0) {
    log(`GROUP FAILED: no successful forges for ${keys.join(", ")}`);
    return { succeeded: [], failed: keys, layerState: prevState };
  }

  // Filtered group's first ticket — used for branch naming, logs, and task names.
  // Distinct from the unfiltered primaryKey(layer) used as groupStates key in processLayers.
  const primaryTicket = keys[0];

  // Step 1: Commit each worktree (continue from forge session)
  log(`COMMITTING: ${primaryTicket} (${successful.length} ticket(s))`);
  await Promise.all(
    successful.flatMap((forge) =>
      forge.worktrees.map(async (wt) => {
        const { code, stdout } = await runner.run(buildCommitPrompt(forge.ticketKey), {
          cwd: wt.worktreePath,
          continueSession: true,
          model: "sonnet",
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
      const baseBranch = prevState.branches.get(repoRoot);
      const { code, stdout } = await runner.run(
        buildMergePrompt(primaryTicket, wtPaths, baseBranch),
        {
          cwd: repoRoot,
          model: "sonnet",
          taskName: `get-shit-done: merge ${primaryTicket} in ${repoRoot}`,
        },
      );
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
      layerState: prevState,
    };
  }
  for (const r of mergeResults) {
    if (r.code !== 0) log(`MERGE FAILED: ${primaryTicket} in ${r.repoRoot}`);
    else if (!r.branch) log(`MERGE WARN: ${primaryTicket} in ${r.repoRoot} — empty branch name`);
  }

  // Step 3: Restart servers on merge branch (only when UI verification needed)
  const mergeBranch = mergedBranches[0].branch;
  log(`MERGE BRANCH: ${mergeBranch}`);
  if (verification.required) {
    await devServers.restartOnBranch(mergeBranch);
  }

  // Step 4: Verify — always run; the skill decides what to check based on verification context
  log(`VERIFYING: ${primaryTicket} (ui required: ${verification.required}, reason: ${verification.reason})`);
  const { code: verifyCode, stdout: verifyOut } = await runner.run(
    buildVerifyPrompt(primaryTicket, verification.required ? devServers.devUrl : "", mergeBranch, verification),
    {
      cwd: mergedBranches[0].repoRoot,
      continueSession: true,
      model: "opus",
      effort: "low",
      taskName: `get-shit-done: verify ${primaryTicket}`,
    },
  );
  runner.writeLog("verify", primaryTicket, verifyOut);

  const verifyResult = parseJson(verifyOut, isVerifyOutput);
  if (verifyCode !== 0) {
    log(`VERIFY FAILED: ${primaryTicket} (exit code: ${verifyCode})`);
  } else if (verifyResult) {
    log(`VERIFY ${verifyResult.status.toUpperCase()}: ${primaryTicket} — ${verifyResult.summary}`);
  }

  // Step 5: Create PRs per repo (continue from forge session for full context)
  const succeededKeys = successful.map((r) => r.ticketKey);
  const screenshots = verifyResult?.screenshots ?? [];
  const nextPrUrls: RepoMap = new Map(prevState.prUrls);

  await Promise.all(
    mergedBranches.map(async (mb) => {
      const baseBranch = prevState.branches.get(mb.repoRoot);
      const basePrUrl = prevState.prUrls.get(mb.repoRoot);
      const dep: PrDependency | undefined =
        baseBranch ? { baseBranch, prUrl: basePrUrl ?? baseBranch } : undefined;
      log(`CREATING PR: ${primaryTicket} in ${mb.repoRoot}${baseBranch ? ` (base: ${baseBranch})` : ""}`);
      const { code: prCode, stdout: prOut } = await runner.run(
        buildPrPrompt(succeededKeys, mb.branch, dep, screenshots),
        {
          cwd: mb.repoRoot,
          continueSession: true,
          model: "sonnet",
          taskName: `get-shit-done: pr ${primaryTicket} in ${mb.repoRoot}`,
        },
      );
      runner.writeLog("pr", primaryTicket, prOut);
      if (prCode !== 0) {
        log(`PR CREATION FAILED: ${primaryTicket} in ${mb.repoRoot}`);
      } else {
        const prUrl = parsePrUrl(prOut);
        if (prUrl) {
          nextPrUrls.set(mb.repoRoot, prUrl);
          // Add verification summary as PR comment
          if (verifyResult?.summary) {
            try {
              const body = `## Verification (${verifyResult.status})\n\n${verifyResult.summary}`;
              execSync(`gh pr comment "${prUrl}" --body-file -`, {
                cwd: mb.repoRoot,
                input: body,
              });
            } catch {
              log(`WARN: Could not add verification comment to ${prUrl}`);
            }
          }
        }
      }
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

  // Build updated per-repo state — carry forward, override with new merges + PR URLs
  const nextBranches: RepoMap = new Map(prevState.branches);
  for (const mb of mergedBranches) {
    nextBranches.set(mb.repoRoot, mb.branch);
  }

  return {
    succeeded: successful.map((r) => r.ticketKey),
    failed: failedKeys,
    layerState: { branches: nextBranches, prUrls: nextPrUrls },
  };
}

// ─── Group processing (forge → merge → verify → PR) ─────────────────────────

export async function processGroup(
  group: TicketAssignment[],
  repos: string[],
  verification: Verification,
  prevState: LayerState,
  runner: ClaudeRunner,
  devServers: DevServerManager,
  jira: JiraClient,
  tracker: ProcessedTracker,
  log: LogFn,
): Promise<GroupResult> {
  if (verification.required) await devServers.startAll();

  const devServerInfo = verification.required ? devServers.devUrl : "";
  const forgeResults = await forgeGroup(group, devServerInfo, runner, jira, log);
  const result = await mergeAndVerify(
    forgeResults,
    group,
    repos,
    verification,
    prevState,
    runner,
    devServers,
    jira,
    tracker,
    log,
  );

  if (verification.required) devServers.stopAll();

  return result;
}

// ─── Process layers (dependency DAG) ─────────────────────────────────────────

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
  initialGroupStates?: GroupStates,
  runState?: RunState,
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  // Per-group state keyed by primary ticket key.
  // Seeded from persisted state on restart so the merge chain is preserved.
  const groupStates: GroupStates = new Map(initialGroupStates ?? []);
  const failedGroups = new Set<string>();
  const ticketToGroup = buildTicketToGroupMap(layers);

  /* oxlint-disable no-await-in-loop -- layers are sequential; each depends on the prior layer */
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const group = filterGroup(layer.group, unprocessedSet, skippedKeys, excludedKeys);
    if (group.length === 0) continue;

    // Unfiltered primary key — stable identifier for groupStates and dependsOn resolution.
    // Branch naming uses the filtered group's first ticket (inside mergeAndVerify).
    const pk = primaryKey(layer);
    const depLabel = layer.dependsOn ? ` →${layer.dependsOn}` : "";
    log(
      `Layer ${i}: [${ticketKeys(group).join(", ")}]${layer.relation ? ` (${layer.relation})` : ""}${depLabel}`,
    );

    // Resolve parent state from the dependency graph
    const prevState = resolveParentState(layer.dependsOn, groupStates, failedGroups, ticketToGroup, log);
    if (prevState === "skip") {
      failedGroups.add(pk);
      failed += group.length;
      continue;
    }

    const result = await processGroup(
      group,
      repos,
      layer.verification,
      prevState,
      runner,
      devServers,
      jira,
      tracker,
      log,
    );
    succeeded += result.succeeded.length;
    failed += result.failed.length;

    if (result.succeeded.length === 0) {
      log(`Layer ${i} group ${pk} failed — downstream dependents will be skipped`);
      failedGroups.add(pk);
    } else {
      groupStates.set(pk, result.layerState);
      runState?.updateGroupStates(groupStates);
    }
  }

  /* oxlint-enable no-await-in-loop */

  return { succeeded, failed };
}
