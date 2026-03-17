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
import { acquireLock, releaseLock, retainLock } from "./lib/lock.js";
import { JiraClient } from "./lib/jira.js";
import { DevServerManager } from "./lib/dev-servers.js";
import { ClaudeRunner } from "./lib/claude-runner.js";
import { postRunCleanup } from "./lib/cleanup.js";
import { RunState } from "./lib/run-state.js";
import { SprintDiscovery } from "./lib/discovery.js";
import { Prioritizer } from "./lib/prioritizer.js";
import { Pipeline } from "./lib/pipeline.js";
import { GSDOrchestrator } from "./lib/orchestrator.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const HOME = process.env.HOME!;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LOG_BASE = join(SCRIPT_DIR, "logs/.get-shit-done");
const STATE_DIR = join(SCRIPT_DIR, "state/.get-shit-done");

mkdirSync(STATE_DIR, { recursive: true });

const jira = new JiraClient(
  process.env.JIRA_CLI || "/opt/homebrew/bin/jira",
  process.env.JIRA_SERVER || "",
  process.env.JIRA_ASSIGNEE || "",
  process.env.JIRA_SPRINT_PREFIX || "",
);
const baseRepos = parseRepos("GSD_REPOS");
const runState = new RunState(join(STATE_DIR, "run-state.json"));
const discovery = new SprintDiscovery(jira, runState, baseRepos);

// ─── Lifecycle ───────────────────────────────────────────────────────────────

let cleanExit = false;
let log: (msg: string) => void = console.log;
let devServers: DevServerManager | null = null;

process.on("exit", () => {
  if (devServers) {
    try {
      postRunCleanup(SCRIPT_DIR, LOG_BASE, devServers, log);
    } catch {
      /* best effort */
    }
  }
  if (cleanExit) releaseLock();
  else {
    retainLock();
    log("ERROR: retaining lock to prevent retry — manual intervention required");
  }
});

async function main() {
  if (!acquireLock(join(STATE_DIR, "lock"))) return;

  // Silent pre-check — no log directory created if nothing to do
  if (!(await discovery.discover())) return;

  // Work found — create timestamped log directory and run
  const LOG_DIR = join(LOG_BASE, makeTimestamp());
  const logger = createLogger(LOG_DIR, join(LOG_DIR, "get-shit-done.log"));
  log = logger.log;

  devServers = new DevServerManager(
    HOME,
    join(HOME, ".claude/scheduler/bootstrap-services.json"),
    join(HOME, ".claude/scheduler/logs/.bootstrap"),
    log,
  );

  const runner = new ClaudeRunner(
    process.env.GSD_CWD || join(HOME, "Envato/seo"),
    LOG_DIR,
    logger.logFile,
  );

  await new GSDOrchestrator({
    discovery,
    prioritizer: new Prioritizer({ runner, scriptDir: SCRIPT_DIR, log }),
    pipeline: new Pipeline({ runner, devServers, jira, runState, log }),
    jira,
    runState,
    baseRepos,
    log,
  }).run();
}

main()
  .then(() => {
    cleanExit = true;
  })
  .catch((err: unknown) => {
    log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  });
