/**
 * Get Shit Done - Automated JIRA ticket implementer
 * Runs every 5 minutes via launchd heartbeat
 * Fetches ALL sprint tickets, prioritizes with grouping, forges in parallel,
 * merges worktree changes, runs verification, and creates PRs.
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
import { spawnClaude } from "./lib/claude.js";
import { parseRepos, discoverRepos } from "./lib/repos.js";
import { acquireLock } from "./lib/lock.js";
import {
  type PrioritizeResult,
  type SprintTicket,
  parsePrioritizerOutput,
  fallbackResult,
  classifyTickets,
  filterGroup,
} from "./lib/prioritizer.js";

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

async function fetchAllSprintTickets(sprint: string): Promise<SprintTicket[]> {
  const jql = `assignee = '${ASSIGNEE}' AND sprint = '${sprint}'`;
  const { ok, stdout } = await exec(JIRA_CLI, [
    "issue", "list", "-q", jql, "--plain", "--no-headers", "--columns", "KEY,STATUS",
  ]);
  if (!ok || !stdout) return [];
  return stdout.split("\n").map((l) => {
    const parts = l.split("\t").map((p) => p.trim());
    return { key: parts[0], status: parts[1] || "" };
  }).filter((t) => t.key);
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

// ─── Forge a single ticket (no verification, no PR) ────────────────────────

async function forgeTicket(
  ticketKey: string,
  repos: string[],
): Promise<{ status: string; worktreePath: string }> {
  const ticketUrl = `${JIRA_SERVER}/browse/${ticketKey}`;
  const repoList = repos.join("\n");
  const taskLog = join(LOG_DIR, `task-${ticketKey}-${TIMESTAMP}.log`);

  const prompt = `Autonomy mode: never use AskUserQuestion tool — explore answers yourself.
Invoke Skill("/forge ${ticketUrl} 'Find the correct repo from: ${repoList}. Multiple repos are possible.'")
Return the JSON output from forge ONLY without code fence.`;

  log(`FORGING: ${ticketKey} -> ${ticketUrl}`);

  const { code, stdout } = await spawnClaude(
    [
      "--model", "sonnet",
      "--permission-mode", "acceptEdits",
      "--add-dir", ...repos,
      "-p", prompt,
    ],
    { cwd: CLAUDE_CWD, taskName: `get-shit-done: forge ${ticketKey}`, timeoutMs: 24 * 60 * 60 * 1000 },
  );

  writeFileSync(taskLog, stdout);

  if (code === 0) {
    log(`FORGED: ${ticketKey}`);
    // Try to extract worktree_path from forge output JSON
    let worktreePath = "";
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*"worktree_path"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        worktreePath = parsed.worktree_path || "";
      }
    } catch { /* ignore parse errors */ }
    return { status: "success", worktreePath };
  }

  log(`FORGE FAILED: ${ticketKey} (exit code: ${code}). See: ${taskLog}`);
  return { status: "failed", worktreePath: "" };
}

// ─── Merge, verify, and create PRs for a group ─────────────────────────────

interface ForgeResult {
  ticketKey: string;
  status: string;
  worktreePath: string;
}

async function processGroup(
  group: string[],
  repos: string[],
  hasFrontend: boolean,
): Promise<{ succeeded: string[]; failed: string[] }> {
  // 1. Forge all tickets in parallel
  log(`FORGING GROUP: ${group.join(", ")}`);
  const forgeResults: ForgeResult[] = [];
  const results = await Promise.allSettled(
    group.map(async (t) => {
      const r = await forgeTicket(t, repos);
      return { ticketKey: t, ...r };
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled") {
      forgeResults.push(r.value);
    } else {
      forgeResults.push({ ticketKey: "", status: "failed", worktreePath: "" });
    }
  }

  const successfulForges = forgeResults.filter((r) => r.status === "success" && r.worktreePath);
  const failedForges = forgeResults.filter((r) => r.status !== "success");

  if (successfulForges.length === 0) {
    log(`GROUP FAILED: no successful forges for ${group.join(", ")}`);
    return { succeeded: [], failed: group };
  }

  // 2. Create merge branch, merge worktrees, verify, and create PRs
  const primaryTicket = group[0];
  const worktreePaths = successfulForges.map((r) => `${r.ticketKey}:${r.worktreePath}`).join("\n");
  const repoList = repos.join("\n");
  const taskLog = join(LOG_DIR, `group-${primaryTicket}-${TIMESTAMP}.log`);

  const devEnvInstruction = hasFrontend
    ? `4. Launch dev env: Skill("/elements-dev-env <backend_path> <storefront_path>") with a 10 minute timeout
   - Use worktree paths if available, otherwise use original repo paths from: ${repoList}
   - Note the dev server URL (e.g. http://localhost:3000)
5. Run verification: Skill("/verification <dev_server_url>") — pass the dev server URL from step 4
6. Kill all dev servers`
    : `4. Run verification: Skill("/verification")`;

  const prompt = `Autonomy mode: never use AskUserQuestion tool — explore answers yourself.
Track progress with a TODO list.

Forge results (ticket:worktree_path):
${worktreePaths}

Steps:
1. Create a merge branch from main named "${primaryTicket}-merge" (include a slug from the primary ticket title)
2. For each worktree, merge its changes into the merge branch:
   - git merge or cherry-pick from each worktree branch
   - Resolve any conflicts
3. Verify the merged code compiles and has no obvious issues
${devEnvInstruction}
${successfulForges.map((r, i) => `${hasFrontend ? i + 7 : i + 5}. In worktree ${r.worktreePath}: Skill("/git-commit") then Skill("/create-pr 'create a Draft PR and keep description concise'")`).join("\n")}`;

  log(`MERGING & VERIFYING GROUP: ${primaryTicket} (${successfulForges.length} ticket(s))`);

  const { code, stdout } = await spawnClaude(
    [
      "--model", "sonnet",
      "--permission-mode", "acceptEdits",
      "--add-dir", ...repos,
      "-p", prompt,
    ],
    { cwd: CLAUDE_CWD, taskName: `get-shit-done: group ${primaryTicket}`, timeoutMs: 24 * 60 * 60 * 1000 },
  );

  writeFileSync(taskLog, stdout);

  const succeeded: string[] = [];
  const failed: string[] = failedForges.map((r) => r.ticketKey).filter(Boolean);

  if (code === 0) {
    for (const r of successfulForges) {
      log(`SUCCESS: ${r.ticketKey}`);
      const { ok: moved } = await exec(JIRA_CLI, ["issue", "move", r.ticketKey, "In Progress"]);
      if (!moved) log(`WARN: Could not move ${r.ticketKey} to In Progress`);
      markProcessed(r.ticketKey);
      succeeded.push(r.ticketKey);
    }
  } else {
    log(`GROUP MERGE/VERIFY FAILED: ${primaryTicket} (exit code: ${code}). See: ${taskLog}`);
    failed.push(...successfulForges.map((r) => r.ticketKey));
  }

  return { succeeded, failed };
}

// ─── Prioritize tickets ─────────────────────────────────────────────────────

async function prioritizeTickets(allTickets: string[]): Promise<PrioritizeResult> {
  if (allTickets.length <= 1) return fallbackResult(allTickets);

  const ticketList = allTickets.join(",");
  const prompt = `Autonomy mode: never use AskUserQuestion tool.
Invoke Skill("/jira-ticket-prioritizer ${ticketList}").
Return json ONLY without code fence`;

  log(`PRIORITIZING: ${allTickets.length} ticket(s) via jira-ticket-prioritizer skill`);

  const { code, stdout } = await spawnClaude(
    ["--model", "sonnet", "--permission-mode", "acceptEdits", "-p", prompt],
    { cwd: SCRIPT_DIR, taskName: `get-shit-done: prioritizing ${allTickets.length} tickets`, timeoutMs: 5 * 60 * 60 * 1000, stderrToLog: logFile },
  );

  if (code === 0) {
    try {
      const result = parsePrioritizerOutput(stdout);
      if (result) {
        log(`PRIORITIZED: ${result.layers.length} layer(s) — ${result.layers.map((l, i) => `L${i}:[${l.group.join(",")}]`).join(" ")}`);
        if (result.skipped.length > 0) log(`SKIPPED: ${result.skipped.map((s) => s.key).join(", ")}`);
        if (result.excluded.length > 0) log(`EXCLUDED: ${result.excluded.map((e) => e.key).join(", ")}`);
        return result;
      }
    } catch (err) {
      log(`WARN: Prioritizer parse failed: ${(err as Error).message}`);
    }
  } else {
    log(`WARN: Prioritizer exited with code ${code}`);
  }

  log(`WARN: Falling back to unprioritized order`);
  return fallbackResult(allTickets);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!acquireLock(LOCK_FILE)) process.exit(0);

  const sprint = await getActiveSprint();
  if (!sprint) process.exit(0);

  // Fetch ALL sprint tickets (any status) for full dependency context
  const allSprintTickets = await fetchAllSprintTickets(sprint);
  if (allSprintTickets.length === 0) process.exit(0);

  const processed = loadProcessed();
  const repos = discoverRepos(BASE_REPOS).map((r) => r.repo);

  log(`Found ${allSprintTickets.length} ticket(s) in sprint.`);

  // Classify: pending (To Do/Backlog) vs context (everything else)
  const { pending: pendingTickets, context: contextTickets } = classifyTickets(allSprintTickets);

  log(`Pending: ${pendingTickets.length}, Context: ${contextTickets.length}`);

  // Filter out already-processed tickets
  let skippedCount = 0;
  const unprocessed: string[] = [];
  for (const t of pendingTickets) {
    if (processed.has(t.key)) {
      log(`SKIP: ${t.key} (already processed today)`);
      skippedCount++;
    } else {
      unprocessed.push(t.key);
    }
  }

  if (unprocessed.length === 0) {
    log(`No unprocessed pending tickets.`);
    process.exit(0);
  }

  // Pass ALL ticket keys to prioritizer (pending + context) for full dependency inference
  const allKeys = allSprintTickets.map((t) => t.key);
  const { layers, skipped, excluded } = await prioritizeTickets(allKeys);

  // Log skipped/excluded
  for (const s of skipped) log(`INFO: skipping ${s.key} — ${s.reason}`);
  for (const e of excluded) log(`INFO: excluded ${e.key} — ${e.reason}`);

  const skippedKeys = new Set(skipped.map((s) => s.key));
  const excludedKeys = new Set(excluded.map((e) => e.key));
  const unprocessedSet = new Set(unprocessed);

  // Filter layers to only unprocessed pending tickets
  let succeededCount = 0;
  let failedCount = 0;

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    const group = filterGroup(layer.group, unprocessedSet, skippedKeys, excludedKeys);

    if (group.length === 0) continue;

    log(`Layer ${layerIdx}: [${group.join(", ")}]${layer.relation ? ` (${layer.relation})` : ""}`);

    const hasFrontend = layer.hasFrontend;

    const { succeeded, failed } = await processGroup(group, repos, hasFrontend);
    succeededCount += succeeded.length;
    failedCount += failed.length;
  }

  log(`=== Summary: processed=${succeededCount} skipped=${skippedCount} failed=${failedCount} ===`);
  cleanupOldLogs(LOG_DIR, ["get-shit-done-", "task-", "group-"], 7);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
