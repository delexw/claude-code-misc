/**
 * Get Shit Done - Automated JIRA ticket implementer
 *
 * Runs every 5 minutes via launchd heartbeat.
 * Fetches sprint tickets, prioritizes with grouping, forges in parallel,
 * merges worktree changes, runs verification, and creates PRs.
 */

import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, makeTimestamp, cleanupOldLogs } from "./lib/logger.js";
import { parseRepos, discoverRepos } from "./lib/repos.js";
import { acquireLock } from "./lib/lock.js";
import { JiraClient } from "./lib/jira.js";
import { ProcessedTracker } from "./lib/processed-tracker.js";
import { DevServerManager } from "./lib/dev-servers.js";
import { ClaudeRunner } from "./lib/claude-runner.js";
import { classifyTickets, prioritizeTickets } from "./lib/prioritizer.js";
import { processLayers } from "./lib/pipeline.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const HOME = process.env.HOME!;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(SCRIPT_DIR, "logs/.get-shit-done");
const STATE_DIR = join(SCRIPT_DIR, "state/.get-shit-done");
const TIMESTAMP = makeTimestamp();

mkdirSync(STATE_DIR, { recursive: true });

const { log, logFile } = createLogger(
  LOG_DIR,
  join(LOG_DIR, `get-shit-done-${TIMESTAMP}.log`),
);

const jira = new JiraClient(
  process.env.JIRA_CLI || "/opt/homebrew/bin/jira",
  process.env.JIRA_SERVER || "",
  process.env.JIRA_ASSIGNEE || "",
  process.env.JIRA_SPRINT_PREFIX || "",
);

const tracker = new ProcessedTracker(join(STATE_DIR, "processed"));
const runner = new ClaudeRunner(
  process.env.GSD_CWD || join(HOME, "Envato/seo"),
  LOG_DIR,
  logFile,
  TIMESTAMP,
);
const baseRepos = parseRepos("GSD_REPOS");

const devServers = new DevServerManager(
  HOME,
  join(HOME, ".claude/scheduler/bootstrap-services.json"),
  join(HOME, ".claude/scheduler/logs/.bootstrap"),
  log,
);

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!acquireLock(join(STATE_DIR, "lock"))) process.exit(0);

  const sprint = await jira.getActiveSprint();
  if (!sprint) process.exit(0);

  const allTickets = await jira.fetchSprintTickets(sprint);
  if (allTickets.length === 0) process.exit(0);

  const processed = tracker.load();
  const repos = discoverRepos(baseRepos).map((r) => r.repo);

  log(`Found ${allTickets.length} ticket(s) in sprint.`);

  const { pending } = classifyTickets(allTickets);
  const unprocessed: string[] = [];
  let skippedCount = 0;

  for (const t of pending) {
    if (processed.has(t.key)) {
      log(`SKIP: ${t.key} (already processed today)`);
      skippedCount++;
    } else {
      unprocessed.push(t.key);
    }
  }

  log(`Pending: ${pending.length}, Total: ${allTickets.length}`);

  if (unprocessed.length === 0) {
    log(`No unprocessed pending tickets.`);
    process.exit(0);
  }

  const allKeys = allTickets.map((t) => t.key);
  const { layers, skipped, excluded } = await prioritizeTickets(allKeys, runner, SCRIPT_DIR, log);

  for (const s of skipped) log(`INFO: skipping ${s.key} — ${s.reason}`);
  for (const e of excluded) log(`INFO: excluded ${e.key} — ${e.reason}`);

  const { succeeded, failed } = await processLayers(
    layers,
    new Set(unprocessed),
    new Set(skipped.map((s) => s.key)),
    new Set(excluded.map((e) => e.key)),
    repos,
    runner,
    devServers,
    jira,
    tracker,
    log,
  );

  log(
    `=== Summary: processed=${succeeded} skipped=${skippedCount} failed=${failed} ===`,
  );
  cleanupOldLogs(LOG_DIR, ["get-shit-done-", "task-", "group-", "merge-", "verify-", "pr-"], 7);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
