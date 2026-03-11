/**
 * Get Shit Done - Automated JIRA ticket implementer
 * Runs every 5 minutes via launchd heartbeat
 * Fetches JIRA tickets (Backlog only) and processes them using Claude's /forge skill
 */

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, makeTimestamp, cleanupOldLogs } from "./lib/logger.js";
import { exec } from "./lib/exec.js";
import { spawnClaude, parseClaudeOutput, formatCost } from "./lib/claude.js";
import { parseRepos, discoverRepos } from "./lib/repos.js";
import { acquireLock } from "./lib/lock.js";

// ─── Configuration ──────────────────────────────────────────────────────────

const HOME = process.env.HOME!;
const JIRA_CLI = process.env.JIRA_CLI || "/opt/homebrew/bin/jira";
const JIRA_SERVER = process.env.JIRA_SERVER || "";
const ASSIGNEE = process.env.JIRA_ASSIGNEE || "";
const SPRINT_PREFIX = process.env.JIRA_SPRINT_PREFIX || "";
const CLAUDE_CWD = process.env.GSD_CWD || join(HOME, "Envato/seo");

const BASE_REPOS = parseRepos("GSD_REPOS");

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(SCRIPT_DIR, "logs/.get-shit-done");
const STATE_DIR = join(SCRIPT_DIR, "state/.get-shit-done");
const LOCK_FILE = join(STATE_DIR, "lock");
const PROCESSED_FILE = join(STATE_DIR, "processed");
const TIMESTAMP = makeTimestamp();
const LOG_FILE = join(LOG_DIR, `get-shit-done-${TIMESTAMP}.log`);
const { log, logFile } = createLogger(LOG_DIR, LOG_FILE);

mkdirSync(STATE_DIR, { recursive: true });

// ─── JIRA helpers ───────────────────────────────────────────────────────────

async function getActiveSprint(): Promise<string | null> {
  const { ok, stdout } = await exec(JIRA_CLI, [
    "sprint", "list", "--state", "active", "--plain", "--no-headers",
  ]);
  if (!ok) return null;
  const line = stdout.split("\n").find((l) => l.includes(SPRINT_PREFIX));
  if (!line) return null;
  return line.split("\t")[1]?.trim() || null;
}

async function fetchTickets(sprint: string): Promise<string[]> {
  const jql = `assignee = '${ASSIGNEE}' AND status in ('To Do', 'Backlog') AND sprint = '${sprint}'`;
  const { ok, stdout } = await exec(JIRA_CLI, [
    "issue", "list", "-q", jql, "--plain", "--no-headers", "--columns", "KEY",
  ]);
  if (!ok || !stdout) return [];
  return stdout.split("\n").map((l) => l.trim()).filter(Boolean);
}

// ─── Processed tracking (daily reset) ───────────────────────────────────────

function readFileSafe(path: string): string {
  try { return readFileSync(path, "utf-8"); } catch { return ""; }
}

function loadProcessed(): Set<string> {
  const today = new Date().toLocaleString("sv-SE").slice(0, 10);
  const content = readFileSafe(PROCESSED_FILE);
  const lines = content.split("\n").filter(Boolean);
  if (lines[0] !== today) {
    writeFileSync(PROCESSED_FILE, today + "\n");
    return new Set();
  }
  return new Set(lines.slice(1));
}

function markProcessed(ticketKey: string): void {
  appendFileSync(PROCESSED_FILE, ticketKey + "\n");
}

// ─── Process a single ticket ────────────────────────────────────────────────

async function processTicket(
  ticketKey: string,
  repos: string[],
): Promise<{ status: string; cost: number }> {
  const ticketUrl = `${JIRA_SERVER}/browse/${ticketKey}`;
  const repoList = repos.join("\n");
  const taskLog = join(LOG_DIR, `task-${ticketKey}-${TIMESTAMP}.log`);

  const prompt = `Autonomy mode: never use AskUserQuestion tool — explore answers yourself.
Track progress with a TODO list. Run each step as a Task subagent:
1. Skill("/forge ${ticketUrl} '
   - Find the correct repo from ${repoList}. Multiple repos are possible.
   - For phase Page inspection AND QA web test:
      - Launch dev env using Skill("/elements-dev-env <backend_path> <storefront_path>")
      - backend_path and storefront_path are the worktree paths if created
        worktrees for those repos, otherwise use the original paths from the repo list
      - After the phase completes, ensure all dev servers are killed before proceeding to the next step
'")
2. In the worktree_path: Skill("/git-commit")
3. In the worktree_path: Skill("/create-pr 'create a Draft PR and keep description concise'")`;

  log(`PROCESSING: ${ticketKey} -> ${ticketUrl}`);

  const { code, stdout } = await spawnClaude(
    [
      "--model", "sonnet",
      "--permission-mode", "acceptEdits",
      "--add-dir", ...repos,
      "--output-format", "json",
      "-p", prompt,
    ],
    { cwd: CLAUDE_CWD, taskName: "get-shit-done", timeoutMs: 2 * 60 * 60 * 1000 },
  );

  if (code === 0) {
    const { costUsd, sessionId } = parseClaudeOutput(stdout);
    const costStr = formatCost(costUsd);
    writeFileSync(taskLog, sessionId + "\n");
    log(`SUCCESS: ${ticketKey} (session: ${sessionId}, cost: ${costStr})`);

    const { ok: moved } = await exec(JIRA_CLI, ["issue", "move", ticketKey, "In Progress"]);
    if (!moved) log(`WARN: Could not move ${ticketKey} to In Progress`);

    markProcessed(ticketKey);
    return { status: "success", cost: costUsd ?? 0 };
  }

  log(`FAILED: ${ticketKey} (exit code: ${code}). See: ${taskLog}`);
  return { status: "failed", cost: 0 };
}

// ─── Prioritize tickets ─────────────────────────────────────────────────────

async function prioritizeTickets(tickets: string[]): Promise<string[][]> {
  if (tickets.length <= 1) return [tickets];

  const ticketList = tickets.join(",");
  const prompt = `Autonomy mode: never use AskUserQuestion tool.
Invoke Skill("/jira-ticket-prioritizer ${ticketList}").
Return json ONLY without code fence`;

  log(`PRIORITIZING: ${tickets.length} ticket(s) via jira-ticket-prioritizer skill`);

  const { code, stdout } = await spawnClaude(
    ["--model", "sonnet", "--permission-mode", "acceptEdits", "-p", prompt],
    { cwd: SCRIPT_DIR, taskName: "get-shit-done", timeoutMs: 30 * 60 * 1000, stderrToLog: logFile },
  );

  if (code === 0) {
    const parsed = JSON.parse(stdout.trim());
    const layers = parsed.layers ?? parsed;
    if (Array.isArray(layers) && layers.every(Array.isArray)) {
      log(`PRIORITIZED: ${layers.length} layer(s) — ${layers.map((l: string[], i: number) => `L${i}:[${l.join(",")}]`).join(" ")}`);
      return layers;
    }
  }

  log(`FATAL: Prioritizer failed (exit ${code})`);
  process.exit(1);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!acquireLock(LOCK_FILE)) process.exit(0);

  const sprint = await getActiveSprint();
  if (!sprint) process.exit(0);

  const tickets = await fetchTickets(sprint);
  if (tickets.length === 0) process.exit(0);

  const processed = loadProcessed();
  const repos = discoverRepos(BASE_REPOS).map((r) => r.repo);

  log(`Found ${tickets.length} ticket(s).`);

  let skipped = 0;
  let succeeded = 0;
  let failed = 0;
  let totalCost = 0;

  const pending: string[] = [];
  for (const ticket of tickets) {
    if (processed.has(ticket)) {
      log(`SKIP: ${ticket} (already processed today)`);
      skipped++;
    } else {
      pending.push(ticket);
    }
  }

  const layers = await prioritizeTickets(pending);

  const pendingSet = new Set(pending);
  const seen = new Set<string>();
  const orderedLayers: string[][] = [];

  for (const layer of layers) {
    const filtered = layer.filter((t) => pendingSet.has(t) && !seen.has(t));
    filtered.forEach((t) => seen.add(t));
    if (filtered.length > 0) orderedLayers.push(filtered);
  }

  const missing = pending.filter((t) => !seen.has(t));
  if (missing.length > 0) {
    orderedLayers.push(missing);
    log(`WARN: ${missing.length} ticket(s) not in prioritizer output, appended as final layer`);
  }

  const BATCH_SIZE = 5;
  for (let layerIdx = 0; layerIdx < orderedLayers.length; layerIdx++) {
    const layer = orderedLayers[layerIdx];
    log(`Layer ${layerIdx}: ${layer.join(", ")}`);

    for (let i = 0; i < layer.length; i += BATCH_SIZE) {
      const batch = layer.slice(i, i + BATCH_SIZE);
      if (layer.length > BATCH_SIZE) {
        log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.join(", ")}`);
      }

      const results = await Promise.allSettled(batch.map((t) => processTicket(t, repos)));
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.status === "success") {
          succeeded++;
          totalCost += r.value.cost;
        } else {
          failed++;
        }
      }
    }
  }

  log(`=== Summary: processed=${succeeded} skipped=${skipped} failed=${failed} cost=$${totalCost.toFixed(4)} ===`);
  cleanupOldLogs(LOG_DIR, ["get-shit-done-", "task-"], 7);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
