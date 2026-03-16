/**
 * GSD Orchestrator — coordinates the full get-shit-done workflow.
 *
 * Steps: discover → classify → prioritize (or resume) → process → summarize
 */

import type { LogFn } from "./claude-runner.js";
import type { ClaudeRunner } from "./claude-runner.js";
import type { DevServerManager } from "./dev-servers.js";
import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";
import type { RunState } from "./run-state.js";
import type { GroupedLayer } from "./prioritizer.js";
import type { GroupStates } from "./pipeline.js";
import { classifyTickets, prioritizeTickets } from "./prioritizer.js";
import { processLayers } from "./pipeline.js";
import { discoverRepos, resetReposToMain } from "./repos.js";

export interface OrchestratorDeps {
  jira: JiraClient;
  tracker: ProcessedTracker;
  runState: RunState;
  runner: ClaudeRunner;
  devServers: DevServerManager;
  baseRepos: string[];
  scriptDir: string;
  log: LogFn;
}

interface DiscoverResult {
  allKeys: string[];
  unprocessed: string[];
  repos: string[];
  skippedCount: number;
}

interface PrioritizeResult {
  layers: GroupedLayer[];
  skipped: Array<{ key: string; reason: string }>;
  excluded: Array<{ key: string; reason: string }>;
  initialGroupStates?: GroupStates;
}

export class GSDOrchestrator {
  private readonly jira: JiraClient;
  private readonly tracker: ProcessedTracker;
  private readonly runState: RunState;
  private readonly runner: ClaudeRunner;
  private readonly devServers: DevServerManager;
  private readonly baseRepos: string[];
  private readonly scriptDir: string;
  private readonly log: LogFn;

  constructor(deps: OrchestratorDeps) {
    this.jira = deps.jira;
    this.tracker = deps.tracker;
    this.runState = deps.runState;
    this.runner = deps.runner;
    this.devServers = deps.devServers;
    this.baseRepos = deps.baseRepos;
    this.scriptDir = deps.scriptDir;
    this.log = deps.log;
  }

  /** Step 1: Fetch sprint tickets and classify into unprocessed vs already-done. */
  async discover(): Promise<DiscoverResult | null> {
    const sprint = await this.jira.getActiveSprint();
    if (!sprint) return null;

    const allTickets = await this.jira.fetchSprintTickets(sprint);
    if (allTickets.length === 0) return null;

    const processed = this.tracker.load();
    const repos = discoverRepos(this.baseRepos).map((r) => r.repo);

    this.log(`Found ${allTickets.length} ticket(s) in sprint.`);

    const { pending } = classifyTickets(allTickets);
    const unprocessed: string[] = [];
    let skippedCount = 0;

    for (const t of pending) {
      if (processed.has(t.key)) {
        this.log(`SKIP: ${t.key} (already processed today)`);
        skippedCount++;
      } else {
        unprocessed.push(t.key);
      }
    }

    this.log(`Pending: ${pending.length}, Total: ${allTickets.length}`);

    if (unprocessed.length === 0) {
      this.log(`No unprocessed pending tickets.`);
      return null;
    }

    return {
      allKeys: allTickets.map((t) => t.key),
      unprocessed,
      repos,
      skippedCount,
    };
  }

  /** Step 2: Prioritize tickets, guided by previous run if available. */
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

    return processLayers(
      layers,
      new Set(discovery.unprocessed),
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

  /** Step 4: Log summary and clean up state on full success. */
  summarize(succeeded: number, skippedCount: number, failed: number): void {
    this.log(`=== Summary: processed=${succeeded} skipped=${skippedCount} failed=${failed} ===`);
    if (failed === 0) this.runState.clear();
  }

  /** Run the full workflow: discover → prioritize → process → summarize. */
  async run(): Promise<void> {
    const discovery = await this.discover();
    if (!discovery) return;

    const prioritization = await this.prioritize(discovery.allKeys);
    const { succeeded, failed } = await this.process(discovery, prioritization);

    this.summarize(succeeded, discovery.skippedCount, failed);
  }
}
