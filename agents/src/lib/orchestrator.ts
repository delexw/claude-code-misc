/**
 * GSD Orchestrator — coordinates the full get-shit-done workflow.
 *
 * Steps: discover → prioritize → process → summarize
 */

import type { LogFn } from "./claude-runner.js";
import type { ClaudeRunner } from "./claude-runner.js";
import type { DevServerManager } from "./dev-servers.js";
import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";
import type { RunState } from "./run-state.js";
import type { GroupedLayer } from "./prioritizer.js";
import type { GroupStates } from "./dag.js";
import type { SprintDiscovery, DiscoverResult } from "./discovery.js";
import { prioritizeTickets } from "./prioritizer.js";
import { processLayers } from "./pipeline.js";
import { resetReposToMain } from "./repos.js";

export interface OrchestratorDeps {
  discovery: SprintDiscovery;
  jira: JiraClient;
  tracker: ProcessedTracker;
  runState: RunState;
  runner: ClaudeRunner;
  devServers: DevServerManager;
  baseRepos: string[];
  scriptDir: string;
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
  private readonly jira: JiraClient;
  private readonly tracker: ProcessedTracker;
  private readonly runState: RunState;
  private readonly runner: ClaudeRunner;
  private readonly devServers: DevServerManager;
  private readonly baseRepos: string[];
  private readonly scriptDir: string;
  private readonly log: LogFn;

  constructor(deps: OrchestratorDeps) {
    this.discovery = deps.discovery;
    this.jira = deps.jira;
    this.tracker = deps.tracker;
    this.runState = deps.runState;
    this.runner = deps.runner;
    this.devServers = deps.devServers;
    this.baseRepos = deps.baseRepos;
    this.scriptDir = deps.scriptDir;
    this.log = deps.log;
  }

  /** Step 1: Prioritize tickets, guided by previous run if available. */
  async prioritize(allKeys: string[]): Promise<PrioritizeResult> {
    resetReposToMain(this.baseRepos, this.log);

    const saved = this.runState.load();

    const result = await prioritizeTickets(
      allKeys,
      this.baseRepos,
      this.runner,
      this.scriptDir,
      this.log,
      saved?.prioritizerResult,
    );
    this.runState.save(result);

    return {
      layers: result.layers,
      skipped: result.skipped,
      excluded: result.excluded,
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

    // Promote excluded pending tickets (e.g. container stories whose sub-tasks are all done)
    const unprocessedSet = new Set(discovery.unprocessed);
    const excludedPending = excluded.filter((e) => unprocessedSet.has(e.key));
    if (excludedPending.length > 0) {
      const promotedParents = new Set<string>();
      await Promise.all(
        excludedPending.map(async (e) => {
          this.log(`PROMOTE: ${e.key} excluded but pending — checking if ready for review`);
          await this.jira.promoteToReview(e.key, this.log, promotedParents);
          this.tracker.mark(e.key);
        }),
      );
    }

    return processLayers(
      layers,
      unprocessedSet,
      new Set(skipped.map((s) => s.key)),
      new Set(excluded.map((e) => e.key)),
      discovery.repos,
      this.runner,
      this.devServers,
      this.jira,
      this.tracker,
      this.log,
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

    const prioritization = await this.prioritize(discovery.allKeys);
    const { succeeded, failed } = await this.process(discovery, prioritization);

    this.summarize(succeeded, discovery.skippedCount, failed);
  }
}
