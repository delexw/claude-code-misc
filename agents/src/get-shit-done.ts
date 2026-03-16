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
import { createLogger, makeTimestamp } from "./lib/logger.js";
import { parseRepos, discoverRepos, resetReposToMain } from "./lib/repos.js";
import { acquireLock, releaseLock } from "./lib/lock.js";
import { JiraClient } from "./lib/jira.js";
import { ProcessedTracker } from "./lib/processed-tracker.js";
import { DevServerManager } from "./lib/dev-servers.js";
import { ClaudeRunner } from "./lib/claude-runner.js";
import { classifyTickets, prioritizeTickets } from "./lib/prioritizer.js";
import { processLayers } from "./lib/pipeline.js";
import { postRunCleanup } from "./lib/cleanup.js";
import { RunState } from "./lib/run-state.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const HOME = process.env.HOME!;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LOG_BASE = join(SCRIPT_DIR, "logs/.get-shit-done");
const STATE_DIR = join(SCRIPT_DIR, "state/.get-shit-done");
const TIMESTAMP = makeTimestamp();
const LOG_DIR = join(LOG_BASE, TIMESTAMP);

mkdirSync(STATE_DIR, { recursive: true });

const { log, logFile } = createLogger(LOG_DIR, join(LOG_DIR, "get-shit-done.log"));

const jira = new JiraClient(
  process.env.JIRA_CLI || "/opt/homebrew/bin/jira",
  process.env.JIRA_SERVER || "",
  process.env.JIRA_ASSIGNEE || "",
  process.env.JIRA_SPRINT_PREFIX || "",
);

const tracker = new ProcessedTracker(join(STATE_DIR, "processed"));
const runState = new RunState(join(STATE_DIR, "run-state.json"));
const runner = new ClaudeRunner(
  process.env.GSD_CWD || join(HOME, "Envato/seo"),
  LOG_DIR,
  logFile,
);
const baseRepos = parseRepos("GSD_REPOS");

const devServers = new DevServerManager(
  HOME,
  join(HOME, ".claude/scheduler/bootstrap-services.json"),
  join(HOME, ".claude/scheduler/logs/.bootstrap"),
  log,
);
let cleanExit = false;

process.on("exit", () => {
  try { postRunCleanup(SCRIPT_DIR, LOG_BASE, devServers, log); } catch { /* best effort */ }
  if (cleanExit) releaseLock();
  else log("ERROR: retaining lock to prevent retry — manual intervention required");
});

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!acquireLock(join(STATE_DIR, "lock"))) return;

  const sprint = await jira.getActiveSprint();
  if (!sprint) return;

  const allTickets = await jira.fetchSprintTickets(sprint);
  if (allTickets.length === 0) return;

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
    return;
  }

  const allKeys = allTickets.map((t) => t.key);
  // Ensure all repos start from main so forge worktrees branch correctly
  resetReposToMain(baseRepos, log);

  // Resume from saved state if available (previous run was interrupted)
  const saved = runState.load(allKeys);
  let layers, skipped, excluded;
  let initialLayerState;

  if (saved) {
    log(`RESUMING: loaded prioritizer result and layer state from previous run`);
    ({ layers, skipped, excluded } = saved.prioritizerResult);
    initialLayerState = saved.layerState;
  } else {
    const result = await prioritizeTickets(
      allKeys,
      baseRepos,
      runner,
      SCRIPT_DIR,
      log,
      processed,
    );
    ({ layers, skipped, excluded } = result);
    runState.savePrioritizerResult(result, allKeys);
  }

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
    initialLayerState,
    runState,
  );

  log(`=== Summary: processed=${succeeded} skipped=${skippedCount} failed=${failed} ===`);

  // Clear saved state on successful completion — no need to resume
  if (failed === 0) runState.clear();
}

main()
  .then(() => { cleanExit = true; })
  .catch((err: unknown) => {
    log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  });
