/**
 * Sprint discovery — finds unprocessed tickets to work on.
 *
 * Separated from the orchestrator so it can run without logging
 * (no log directory created when there's nothing to do).
 */

import type { JiraClient } from "./jira.js";
import type { RunState } from "./run-state.js";
import { classifyTickets } from "./prioritizer.js";

export interface DiscoverResult {
  allKeys: string[];
  unprocessed: string[];
  skippedCount: number;
}

export class SprintDiscovery {
  constructor(
    private readonly jira: JiraClient,
    private readonly runState: RunState,
    private readonly baseRepos: string[],
  ) {}

  /** Find unprocessed pending tickets. Optionally logs details. */
  async discover(log?: (msg: string) => void): Promise<DiscoverResult | null> {
    const sprint = await this.jira.getActiveSprint();
    if (!sprint) return null;

    const allTickets = await this.jira.fetchSprintTickets(sprint);
    if (allTickets.length === 0) return null;

    const completed = this.runState.completedTicketKeys();

    log?.(`Found ${allTickets.length} ticket(s) in sprint.`);

    const { pending } = classifyTickets(allTickets);
    const unprocessed: string[] = [];
    let skippedCount = 0;

    for (const t of pending) {
      if (completed.has(t.key)) {
        log?.(`SKIP: ${t.key} (already completed)`);
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

    return { allKeys: allTickets.map((t) => t.key), unprocessed, skippedCount };
  }
}
