/**
 * Sprint discovery — finds unprocessed tickets to work on.
 *
 * Separated from the orchestrator so it can run without logging
 * (no log directory created when there's nothing to do).
 */

import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";
import { classifyTickets } from "./prioritizer.js";
import { discoverRepos } from "./repos.js";

export interface DiscoverResult {
  allKeys: string[];
  unprocessed: string[];
  repos: string[];
  skippedCount: number;
}

export class SprintDiscovery {
  constructor(
    private readonly jira: JiraClient,
    private readonly tracker: ProcessedTracker,
    private readonly baseRepos: string[],
  ) {}

  /** Find unprocessed pending tickets. Optionally logs details. */
  async discover(log?: (msg: string) => void): Promise<DiscoverResult | null> {
    const sprint = await this.jira.getActiveSprint();
    if (!sprint) return null;

    const allTickets = await this.jira.fetchSprintTickets(sprint);
    if (allTickets.length === 0) return null;

    const processed = this.tracker.load();
    const repos = discoverRepos(this.baseRepos).map((r) => r.repo);

    log?.(`Found ${allTickets.length} ticket(s) in sprint.`);

    const { pending } = classifyTickets(allTickets);
    const unprocessed: string[] = [];
    let skippedCount = 0;

    for (const t of pending) {
      if (processed.has(t.key)) {
        log?.(`SKIP: ${t.key} (already processed today)`);
        skippedCount++;
      } else {
        unprocessed.push(t.key);
      }
    }

    log?.(`Pending: ${pending.length}, Total: ${allTickets.length}`);

    if (unprocessed.length === 0) {
      log?.(`No unprocessed pending tickets.`);
      return null;
    }

    return { allKeys: allTickets.map((t) => t.key), unprocessed, repos, skippedCount };
  }
}
