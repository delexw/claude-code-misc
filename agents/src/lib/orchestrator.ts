/**
 * GSD Orchestrator — coordinates the full get-shit-done workflow.
 *
 * Steps: discover → prioritize → process → summarize
 */

import type { LogFn } from "./claude-runner.js";
import type { JiraClient } from "./jira.js";
import type { RunState } from "./run-state.js";
import type { GroupedLayer } from "./prioritizer.js";
import type { GroupStates } from "./dag.js";
import type { SprintDiscovery, DiscoverResult } from "./discovery.js";
import { Prioritizer } from "./prioritizer.js";
import { Pipeline } from "./pipeline.js";
import { resetReposToMain } from "./repos.js";

export interface OrchestratorDeps {
  discovery: SprintDiscovery;
  prioritizer: Prioritizer;
  pipeline: Pipeline;
  jira: JiraClient;
  runState: RunState;
  baseRepos: string[];
  log: LogFn;
}

interface PrioritizeResult {
  layers: GroupedLayer[];
  skipped: Array<{ key: string; reason: string }>;
  excluded: Array<{ key: string; reason: string }>;
  initialGroupStates?: GroupStates;
}

export class GSDOrchestrator {
  private readonly discovery: SprintDiscovery;
  private readonly prioritizer: Prioritizer;
  private readonly pipeline: Pipeline;
  private readonly jira: JiraClient;
  private readonly runState: RunState;
  private readonly baseRepos: string[];
  private readonly log: LogFn;

  constructor(deps: OrchestratorDeps) {
    this.discovery = deps.discovery;
    this.prioritizer = deps.prioritizer;
    this.pipeline = deps.pipeline;
    this.jira = deps.jira;
    this.runState = deps.runState;
    this.baseRepos = deps.baseRepos;
    this.log = deps.log;
  }

  /**
   * Re-include in-flight tickets from a previous run that were moved to
   * "In Progress" by forge but never completed (crash/restart scenario).
   * Discovery drops them because classifyTickets only considers "To Do"/"Backlog".
   * Skips tickets whose group already completed (has PRs — e.g. "In Review").
   */
  private resumeInFlightTickets(discovery: DiscoverResult): void {
    const previousKeys = this.runState.previousTicketKeys();
    if (previousKeys.size === 0) return;

    const completedKeys = this.runState.completedTicketKeys();
    const unprocessedSet = new Set(discovery.unprocessed);

    for (const key of previousKeys) {
      if (completedKeys.has(key) || unprocessedSet.has(key) || !discovery.allKeys.includes(key)) {
        if (completedKeys.has(key) && !unprocessedSet.has(key) && discovery.allKeys.includes(key)) {
          this.log(`SKIP RESUME: ${key} — already completed in previous run`);
        }
        continue;
      }
      discovery.unprocessed.push(key);
      this.log(`RESUME: ${key} — in-flight from previous run, re-including`);
    }
  }

  /** Step 1: Prioritize tickets, guided by previous run if available. */
  async prioritize(allKeys: string[], sprint: string): Promise<PrioritizeResult> {
    resetReposToMain(this.baseRepos, this.log);

    const saved = this.runState.load();

    const { resolved, rawJson } = await this.prioritizer.prioritize(
      allKeys,
      this.baseRepos,
      saved?.prioritizerRawJson,
    );
    this.runState.save(rawJson, sprint);

    return {
      layers: resolved.layers,
      skipped: resolved.skipped,
      excluded: resolved.excluded,
      initialGroupStates: saved?.groupStates,
    };
  }

  /** Step 3: Process layers — forge, merge, verify, PR. */
  async process(
    discovery: DiscoverResult,
    prioritization: PrioritizeResult,
  ): Promise<{ succeeded: number; failed: number }> {
    const { layers, skipped, excluded, initialGroupStates } = prioritization;

    for (const s of skipped) this.log(`INFO: skipping ${s.key} — ${s.reason}`);
    for (const e of excluded) this.log(`INFO: excluded ${e.key} — ${e.reason}`);

    const unprocessedSet = new Set(discovery.unprocessed);

    // Promote excluded container stories whose sub-tasks are all already done.
    // Catches the case where a previous run finished all sub-tasks but crashed
    // before promoting the parent.
    const excludedPending = excluded.filter((e) => unprocessedSet.has(e.key));
    if (excludedPending.length > 0) {
      const promotedParents = new Set<string>();
      /* oxlint-disable no-await-in-loop -- sequential: promotedParents dedup requires ordering */
      for (const e of excludedPending) {
        const hasUnfinished = await this.jira.hasUnfinishedSubtasks(e.key);
        if (hasUnfinished) {
          this.log(`SKIP PROMOTE: ${e.key} — still has unfinished sub-tasks`);
        } else {
          this.log(`PROMOTE: ${e.key} — all sub-tasks complete`);
          await this.jira.promoteToReview(e.key, this.log, promotedParents);
        }
        this.runState.markCompleted(e.key);
      }
      /* oxlint-enable no-await-in-loop */
    }

    return this.pipeline.processLayers(
      layers,
      unprocessedSet,
      new Set(skipped.map((s) => s.key)),
      new Set(excluded.map((e) => e.key)),
      initialGroupStates,
      this.runState,
    );
  }

  /** Step 4: Log summary. State is preserved for next-run guidance. */
  summarize(succeeded: number, skippedCount: number, failed: number): void {
    this.log(`=== Summary: processed=${succeeded} skipped=${skippedCount} failed=${failed} ===`);
  }

  /** Run the full workflow: discover → prioritize → process → summarize. */
  async run(): Promise<void> {
    const discovery = await this.discovery.discover(this.log);
    if (!discovery) return;

    const pruned = this.runState.pruneMergedGroups();
    for (const key of pruned) {
      this.log(`PRUNED: ${key} — PR merged, removed from run state`);
    }

    this.resumeInFlightTickets(discovery);

    const prioritization = await this.prioritize(discovery.allKeys, discovery.sprint);
    const { succeeded, failed } = await this.process(discovery, prioritization);

    this.summarize(succeeded, discovery.skippedCount, failed);
  }
}
