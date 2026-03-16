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
import { filterGroup, ticketKeys } from "./prioritizer.js";
import { parseJson } from "./json.js";
import { ForgeService } from "./forge.js";
import type { RunState } from "./run-state.js";
import { Dag, type GroupStates, type LayerState, type RepoMap, primaryKey } from "./dag.js";

// Re-export DAG types for consumers that previously imported from pipeline
export type { GroupStates, LayerState, RepoMap } from "./dag.js";

// ─── Types ──────────────────────────────────────────────────────────────────

interface GroupResult {
  succeeded: string[];
  failed: string[];
  layerState: LayerState;
}

interface MergeResult {
  repoRoot: string;
  code: number;
  branch: string;
}

interface VerifyOutput {
  status: "passed" | "fixed" | "skipped";
  summary: string;
  screenshots?: string[];
}

interface PrOutput {
  pr_url: string;
  status: "success";
}

// ─── Type guards ────────────────────────────────────────────────────────────

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

// ─── Static helpers ─────────────────────────────────────────────────────────

function parsePrUrl(stdout: string): string {
  return parseJson(stdout, isPrOutput)?.pr_url ?? "";
}

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

// ─── Pipeline deps ──────────────────────────────────────────────────────────

export interface PipelineDeps {
  runner: ClaudeRunner;
  devServers: DevServerManager;
  jira: JiraClient;
  tracker: ProcessedTracker;
  log: LogFn;
}

// ─── Pipeline class ─────────────────────────────────────────────────────────

export class Pipeline {
  private readonly runner: ClaudeRunner;
  private readonly devServers: DevServerManager;
  private readonly jira: JiraClient;
  private readonly tracker: ProcessedTracker;
  private readonly log: LogFn;
  private readonly forge: ForgeService;

  constructor(deps: PipelineDeps) {
    this.runner = deps.runner;
    this.devServers = deps.devServers;
    this.jira = deps.jira;
    this.tracker = deps.tracker;
    this.log = deps.log;
    this.forge = new ForgeService({ runner: deps.runner, jira: deps.jira, log: deps.log });
  }

  /** Commit → merge → verify → PR → JIRA update. */
  async mergeAndVerify(
    forges: ForgeResult[],
    group: TicketAssignment[],
    repos: string[],
    verification: Verification,
    prevState: LayerState,
  ): Promise<GroupResult> {
    const keys = ticketKeys(group);
    const successful = forges.filter((r) => r.status !== "failed" && r.worktrees.length > 0);
    const failedKeys = forges.filter((r) => r.status === "failed").map((r) => r.ticketKey);

    if (successful.length === 0) {
      this.log(`GROUP FAILED: no successful forges for ${keys.join(", ")}`);
      return { succeeded: [], failed: keys, layerState: prevState };
    }

    const primaryTicket = keys[0];

    await this.commitWorktrees(primaryTicket, successful);

    const mergedBranches = await this.mergeWorktrees(primaryTicket, successful, prevState);
    if (mergedBranches.length === 0) {
      this.log(`MERGE FAILED: ${primaryTicket} — all repos failed or produced empty branch names`);
      return {
        succeeded: [],
        failed: [...failedKeys, ...successful.map((r) => r.ticketKey)],
        layerState: prevState,
      };
    }

    const mergeBranch = mergedBranches[0].branch;
    await this.restartServersIfNeeded(mergeBranch, verification);

    const verifyResult = await this.verify(
      primaryTicket,
      mergeBranch,
      mergedBranches[0].repoRoot,
      verification,
    );

    const nextPrUrls = await this.createPullRequests(
      primaryTicket,
      successful.map((r) => r.ticketKey),
      mergedBranches,
      prevState,
      verifyResult,
    );

    await this.updateJira(successful);

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

  /** Forge → merge+verify → manage dev servers. */
  async processGroup(
    group: TicketAssignment[],
    repos: string[],
    verification: Verification,
    prevState: LayerState,
  ): Promise<GroupResult> {
    if (verification.required) await this.devServers.startAll();

    const devServerInfo = verification.required ? this.devServers.devUrl : "";
    const forgeResults = await this.forge.forgeGroup(group, devServerInfo);
    const result = await this.mergeAndVerify(forgeResults, group, repos, verification, prevState);

    if (verification.required) this.devServers.stopAll();

    return result;
  }

  /** Walk layers sequentially, resolving DAG dependencies between groups. */
  async processLayers(
    layers: GroupedLayer[],
    unprocessedSet: Set<string>,
    skippedKeys: Set<string>,
    excludedKeys: Set<string>,
    repos: string[],
    initialGroupStates?: GroupStates,
    runState?: RunState,
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    const dag = new Dag(layers, this.log, initialGroupStates);

    /* oxlint-disable no-await-in-loop -- layers are sequential; each depends on the prior layer */
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const group = filterGroup(layer.group, unprocessedSet, skippedKeys, excludedKeys);
      if (group.length === 0) continue;

      const pk = primaryKey(layer);
      const depLabel = layer.dependsOn ? ` →${layer.dependsOn}` : "";
      this.log(
        `Layer ${i}: [${ticketKeys(group).join(", ")}]${layer.relation ? ` (${layer.relation})` : ""}${depLabel}`,
      );

      const prevState = dag.resolve(layer.dependsOn);
      if (prevState === "skip") {
        dag.fail(pk);
        failed += group.length;
        continue;
      }

      const result = await this.processGroup(group, repos, layer.verification, prevState);
      succeeded += result.succeeded.length;
      failed += result.failed.length;

      if (result.succeeded.length === 0) {
        this.log(`Layer ${i} group ${pk} failed — downstream dependents will be skipped`);
        dag.fail(pk);
      } else {
        dag.record(pk, result.layerState);
        runState?.updateGroupStates(dag.snapshot());
      }
    }

    /* oxlint-enable no-await-in-loop */

    return { succeeded, failed };
  }

  // ─── Private steps ──────────────────────────────────────────────────────────

  /** Step 1: Commit each worktree (continue from forge session). */
  private async commitWorktrees(primaryTicket: string, successful: ForgeResult[]): Promise<void> {
    this.log(`COMMITTING: ${primaryTicket} (${successful.length} ticket(s))`);
    await Promise.all(
      successful.flatMap((forge) =>
        forge.worktrees.map(async (wt) => {
          const { code, stdout } = await this.runner.run(buildCommitPrompt(forge.ticketKey), {
            cwd: wt.worktreePath,
            continueSession: true,
            model: "sonnet",
            taskName: `get-shit-done: commit ${forge.ticketKey}`,
          });
          this.runner.writeLog("commit", forge.ticketKey, stdout);
          if (code !== 0)
            this.log(`COMMIT WARN: ${forge.ticketKey} in ${wt.worktreePath} (exit code: ${code})`);
        }),
      ),
    );
  }

  /** Step 2: Merge committed worktrees per repo in parallel. */
  private async mergeWorktrees(
    primaryTicket: string,
    successful: ForgeResult[],
    prevState: LayerState,
  ): Promise<MergeResult[]> {
    const worktreesByRepo = groupWorktreesByRepo(successful);
    this.log(`MERGING: ${primaryTicket} across ${worktreesByRepo.size} repo(s)`);

    const mergeResults = await Promise.all(
      [...worktreesByRepo.entries()].map(async ([repoRoot, wtPaths]) => {
        const baseBranch = prevState.branches.get(repoRoot);
        const { code, stdout } = await this.runner.run(
          buildMergePrompt(primaryTicket, wtPaths, baseBranch),
          {
            cwd: repoRoot,
            model: "sonnet",
            taskName: `get-shit-done: merge ${primaryTicket} in ${repoRoot}`,
          },
        );
        this.runner.writeLog("merge", primaryTicket, stdout);
        const branch = stdout.trim().split("\n").pop()?.trim() || "";
        return { repoRoot, code, branch };
      }),
    );

    const mergedBranches = mergeResults.filter((r) => r.code === 0 && r.branch);
    for (const r of mergeResults) {
      if (r.code !== 0) this.log(`MERGE FAILED: ${primaryTicket} in ${r.repoRoot}`);
      else if (!r.branch)
        this.log(`MERGE WARN: ${primaryTicket} in ${r.repoRoot} — empty branch name`);
    }

    this.log(`MERGE BRANCH: ${mergedBranches[0]?.branch ?? "(none)"}`);
    return mergedBranches;
  }

  /** Step 3: Restart dev servers on merge branch when UI verification is needed. */
  private async restartServersIfNeeded(
    mergeBranch: string,
    verification: Verification,
  ): Promise<void> {
    if (verification.required) {
      await this.devServers.restartOnBranch(mergeBranch);
    }
  }

  /** Step 4: Run verification skill. */
  private async verify(
    primaryTicket: string,
    mergeBranch: string,
    cwd: string,
    verification: Verification,
  ): Promise<VerifyOutput | null> {
    this.log(
      `VERIFYING: ${primaryTicket} (ui required: ${verification.required}, reason: ${verification.reason})`,
    );
    const { code, stdout } = await this.runner.run(
      buildVerifyPrompt(
        primaryTicket,
        verification.required ? this.devServers.devUrl : "",
        mergeBranch,
        verification,
      ),
      {
        cwd,
        continueSession: true,
        model: "opus",
        effort: "low",
        taskName: `get-shit-done: verify ${primaryTicket}`,
      },
    );
    this.runner.writeLog("verify", primaryTicket, stdout);

    const result = parseJson(stdout, isVerifyOutput);
    if (code !== 0) {
      this.log(`VERIFY FAILED: ${primaryTicket} (exit code: ${code})`);
    } else if (result) {
      this.log(`VERIFY ${result.status.toUpperCase()}: ${primaryTicket} — ${result.summary}`);
    }
    return result;
  }

  /** Step 5: Create PRs per repo. */
  private async createPullRequests(
    primaryTicket: string,
    succeededKeys: string[],
    mergedBranches: MergeResult[],
    prevState: LayerState,
    verifyResult: VerifyOutput | null,
  ): Promise<RepoMap> {
    const screenshots = verifyResult?.screenshots ?? [];
    const nextPrUrls: RepoMap = new Map(prevState.prUrls);

    await Promise.all(
      mergedBranches.map(async (mb) => {
        const baseBranch = prevState.branches.get(mb.repoRoot);
        const basePrUrl = prevState.prUrls.get(mb.repoRoot);
        const dep: PrDependency | undefined = baseBranch
          ? { baseBranch, prUrl: basePrUrl ?? baseBranch }
          : undefined;
        this.log(
          `CREATING PR: ${primaryTicket} in ${mb.repoRoot}${baseBranch ? ` (base: ${baseBranch})` : ""}`,
        );
        const { code, stdout } = await this.runner.run(
          buildPrPrompt(succeededKeys, mb.branch, dep, screenshots),
          {
            cwd: mb.repoRoot,
            continueSession: true,
            model: "sonnet",
            taskName: `get-shit-done: pr ${primaryTicket} in ${mb.repoRoot}`,
          },
        );
        this.runner.writeLog("pr", primaryTicket, stdout);
        if (code !== 0) {
          this.log(`PR CREATION FAILED: ${primaryTicket} in ${mb.repoRoot}`);
        } else {
          const prUrl = parsePrUrl(stdout);
          if (prUrl) {
            nextPrUrls.set(mb.repoRoot, prUrl);
            this.addVerificationComment(mb.repoRoot, prUrl, verifyResult);
          }
        }
      }),
    );

    return nextPrUrls;
  }

  /** Step 6: Move tickets to In Review and promote parents. */
  private async updateJira(successful: ForgeResult[]): Promise<void> {
    const promotedParents = new Set<string>();
    await Promise.all(
      successful.map(async (r) => {
        this.log(`SUCCESS: ${r.ticketKey}`);
        await this.jira.promoteToReview(r.ticketKey, this.log, promotedParents);
        this.tracker.mark(r.ticketKey);
      }),
    );
  }

  /** Add verification summary as a PR comment. */
  private addVerificationComment(
    cwd: string,
    prUrl: string,
    verifyResult: VerifyOutput | null,
  ): void {
    if (!verifyResult?.summary) return;
    try {
      const body = `## Verification (${verifyResult.status})\n\n${verifyResult.summary}`;
      execSync(`gh pr comment "${prUrl}" --body-file -`, { cwd, input: body });
    } catch {
      this.log(`WARN: Could not add verification comment to ${prUrl}`);
    }
  }
}
