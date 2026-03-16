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
import { parseRepos } from "./lib/repos.js";
import { acquireLock, releaseLock } from "./lib/lock.js";
import { JiraClient } from "./lib/jira.js";
import { ProcessedTracker } from "./lib/processed-tracker.js";
import { DevServerManager } from "./lib/dev-servers.js";
import { ClaudeRunner } from "./lib/claude-runner.js";
import { postRunCleanup } from "./lib/cleanup.js";
import { RunState } from "./lib/run-state.js";
import { GSDOrchestrator } from "./lib/orchestrator.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const HOME = process.env.HOME!;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LOG_BASE = join(SCRIPT_DIR, "logs/.get-shit-done");
const STATE_DIR = join(SCRIPT_DIR, "state/.get-shit-done");
const LOG_DIR = join(LOG_BASE, makeTimestamp());

mkdirSync(STATE_DIR, { recursive: true });

const { log, logFile } = createLogger(LOG_DIR, join(LOG_DIR, "get-shit-done.log"));

const devServers = new DevServerManager(
  HOME,
  join(HOME, ".claude/scheduler/bootstrap-services.json"),
  join(HOME, ".claude/scheduler/logs/.bootstrap"),
  log,
);

const orchestrator = new GSDOrchestrator({
  jira: new JiraClient(
    process.env.JIRA_CLI || "/opt/homebrew/bin/jira",
    process.env.JIRA_SERVER || "",
    process.env.JIRA_ASSIGNEE || "",
    process.env.JIRA_SPRINT_PREFIX || "",
  ),
  tracker: new ProcessedTracker(join(STATE_DIR, "processed")),
  runState: new RunState(join(STATE_DIR, "run-state.json")),
  runner: new ClaudeRunner(
    process.env.GSD_CWD || join(HOME, "Envato/seo"),
    LOG_DIR,
    logFile,
  ),
  devServers,
  baseRepos: parseRepos("GSD_REPOS"),
  scriptDir: SCRIPT_DIR,
  log,
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────

let cleanExit = false;

process.on("exit", () => {
  try { postRunCleanup(SCRIPT_DIR, LOG_BASE, devServers, log); } catch { /* best effort */ }
  if (cleanExit) releaseLock();
  else log("ERROR: retaining lock to prevent retry — manual intervention required");
});

async function main() {
  if (!acquireLock(join(STATE_DIR, "lock"))) return;
  await orchestrator.run();
}

main()
  .then(() => { cleanExit = true; })
  .catch((err: unknown) => {
    log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  });
