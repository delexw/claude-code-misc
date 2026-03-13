/**
 * Get Shit Done - Automated JIRA ticket implementer
 * Runs every 5 minutes via launchd heartbeat.
 * Fetches sprint tickets, prioritizes with grouping, forges in parallel,
 * merges worktree changes, runs verification, and creates PRs.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, makeTimestamp, cleanupOldLogs } from "./lib/logger.js";
import { spawnClaude } from "./lib/claude.js";
import { parseRepos, discoverRepos } from "./lib/repos.js";
import { acquireLock } from "./lib/lock.js";
import { JiraClient } from "./lib/jira.js";
import { ProcessedTracker } from "./lib/processed-tracker.js";
import {
  type PrioritizeResult,
  type GroupedLayer,
  parsePrioritizerOutput,
  fallbackResult,
  classifyTickets,
  filterGroup,
} from "./lib/prioritizer.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type ForgeStatus = "success" | "failed";

interface ForgeResult {
  ticketKey: string;
  status: ForgeStatus;
  worktreePath: string;
}

interface GroupResult {
  succeeded: string[];
  failed: string[];
}

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
const claudeCwd = process.env.GSD_CWD || join(HOME, "Envato/seo");
const baseRepos = parseRepos("GSD_REPOS");

// ─── Claude task runner ──────────────────────────────────────────────────────

async function runClaudeTask(
  prompt: string,
  opts: {
    repos?: string[];
    taskName: string;
    timeoutMs?: number;
    cwd?: string;
    model?: string;
  },
): Promise<{ code: number; stdout: string }> {
  const args = [
    "--model",
    opts.model || "sonnet",
    "--permission-mode",
    "acceptEdits",
  ];
  if (opts.repos) args.push("--add-dir", ...opts.repos);
  args.push("-p", prompt);

  return spawnClaude(args, {
    cwd: opts.cwd ?? claudeCwd,
    taskName: opts.taskName,
    timeoutMs: opts.timeoutMs ?? 24 * 60 * 60 * 1000,
    stderrToLog: logFile,
  });
}

function writeTaskLog(prefix: string, id: string, content: string): string {
  const path = join(LOG_DIR, `${prefix}-${id}-${TIMESTAMP}.log`);
  writeFileSync(path, content);
  return path;
}

// ─── JSON extraction ─────────────────────────────────────────────────────────

function extractWorktreePath(stdout: string): string {
  try {
    const match = stdout.match(/\{[^{}]*"worktree_path"[^{}]*\}/);
    if (match) return JSON.parse(match[0]).worktree_path || "";
  } catch (err) {
    log(`WARN: Failed to parse worktree_path: ${(err as Error).message}`);
  }
  return "";
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

const AUTONOMY_PREFIX =
  "Autonomy mode: never use AskUserQuestion tool — explore answers yourself.";

function buildForgePrompt(
  ticketKey: string,
  ticketUrl: string,
  repos: string[],
): string {
  const repoList = repos.join("\n");
  return `[GSD: forge ${ticketKey}] ${AUTONOMY_PREFIX}
Invoke Skill("/forge ${ticketUrl} 'Find the correct repo from: ${repoList}. Multiple repos are possible.'")
Return the JSON output from forge ONLY without code fence.`;
}

function buildGroupPrompt(
  primaryTicket: string,
  forges: ForgeResult[],
  repos: string[],
  hasFrontend: boolean,
): string {
  const worktreePaths = forges
    .map((r) => `${r.ticketKey}:${r.worktreePath}`)
    .join("\n");
  const repoList = repos.join("\n");

  const devEnvSteps = hasFrontend
    ? `4. Bootstrap all dev services in a single subagent (model: sonnet):
   - Launch one Agent(model: sonnet) with a prompt to run ALL 5 bootstrap skills in parallel:
     - Determine the merge branch name from step 1
     - For each service, use worktree paths if available, otherwise use original repo paths from: ${repoList}
     - Skill("/elements-backend-bootstrap <backend_path> bootstrap on <merge_branch> branch")
     - Skill("/elements-storefront-bootstrap <storefront_path> bootstrap on <merge_branch> branch")
     - Skill("/elements-payment-bootstrap bootstrap on main branch")
     - Skill("/elements-search-bootstrap bootstrap on main branch")
     - Skill("/sso-server-bootstrap bootstrap on main branch")
     - Return all dev server URLs once ready
5. Run verification in a subagent: Agent(prompt: "Skill('/verification <dev_server_url>')") — pass the primary dev server URL from step 4
6. Kill all dev servers`
    : `4. Run verification in a subagent: Agent(prompt: "Skill('/verification')")`;

  const prStepBase = hasFrontend ? 7 : 5;
  const prSteps = forges
    .map(
      (r, i) =>
        `${prStepBase + i}. In worktree ${r.worktreePath}: Skill("/git-commit") then Skill("/create-pr 'create a Draft PR and keep description concise'")`,
    )
    .join("\n");

  return `[GSD: merge+verify ${primaryTicket}] ${AUTONOMY_PREFIX}
Track progress with a TODO list.

Forge results (ticket:worktree_path):
${worktreePaths}

Steps:
1. Create a merge branch from main named "${primaryTicket}-merge" (include a slug from the primary ticket title)
2. For each worktree, merge its changes into the merge branch:
   - git merge or cherry-pick from each worktree branch
   - Resolve any conflicts
3. Verify the merged code compiles and has no obvious issues
${devEnvSteps}
${prSteps}`;
}

// ─── Forge a single ticket ───────────────────────────────────────────────────

async function forgeTicket(
  ticketKey: string,
  repos: string[],
): Promise<ForgeResult> {
  const ticketUrl = jira.ticketUrl(ticketKey);
  log(`FORGING: ${ticketKey} -> ${ticketUrl}`);

  const { code, stdout } = await runClaudeTask(
    buildForgePrompt(ticketKey, ticketUrl, repos),
    { repos, taskName: `get-shit-done: forge ${ticketKey}`, model: "opus" },
  );

  writeTaskLog("task", ticketKey, stdout);

  if (code !== 0) {
    log(`FORGE FAILED: ${ticketKey} (exit code: ${code})`);
    return { ticketKey, status: "failed", worktreePath: "" };
  }

  log(`FORGED: ${ticketKey}`);
  return {
    ticketKey,
    status: "success",
    worktreePath: extractWorktreePath(stdout),
  };
}

// ─── Forge, merge, verify, and PR a group of tickets ─────────────────────────

async function forgeGroup(
  group: string[],
  repos: string[],
): Promise<ForgeResult[]> {
  log(`FORGING GROUP: ${group.join(", ")}`);
  const results = await Promise.allSettled(
    group.map((t) => forgeTicket(t, repos)),
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          ticketKey: group[i],
          status: "failed" as ForgeStatus,
          worktreePath: "",
        },
  );
}

async function mergeAndVerify(
  forges: ForgeResult[],
  group: string[],
  repos: string[],
  hasFrontend: boolean,
): Promise<GroupResult> {
  const successful = forges.filter(
    (r) => r.status === "success" && r.worktreePath,
  );
  const failedKeys = forges
    .filter((r) => r.status !== "success")
    .map((r) => r.ticketKey);

  if (successful.length === 0) {
    log(`GROUP FAILED: no successful forges for ${group.join(", ")}`);
    return { succeeded: [], failed: group };
  }

  const primaryTicket = group[0];
  log(
    `MERGING & VERIFYING GROUP: ${primaryTicket} (${successful.length} ticket(s))`,
  );

  const { code, stdout } = await runClaudeTask(
    buildGroupPrompt(primaryTicket, successful, repos, hasFrontend),
    { repos, taskName: `get-shit-done: group ${primaryTicket}` },
  );

  writeTaskLog("group", primaryTicket, stdout);

  if (code !== 0) {
    log(`GROUP MERGE/VERIFY FAILED: ${primaryTicket} (exit code: ${code})`);
    return {
      succeeded: [],
      failed: [...failedKeys, ...successful.map((r) => r.ticketKey)],
    };
  }

  for (const r of successful) {
    log(`SUCCESS: ${r.ticketKey}`);
    const moved = await jira.moveTicket(r.ticketKey, "In Progress");
    if (!moved) log(`WARN: Could not move ${r.ticketKey} to In Progress`);
    tracker.mark(r.ticketKey);
  }

  return {
    succeeded: successful.map((r) => r.ticketKey),
    failed: failedKeys,
  };
}

async function processGroup(
  group: string[],
  repos: string[],
  hasFrontend: boolean,
): Promise<GroupResult> {
  const forgeResults = await forgeGroup(group, repos);
  return mergeAndVerify(forgeResults, group, repos, hasFrontend);
}

// ─── Prioritize tickets ──────────────────────────────────────────────────────

async function prioritizeTickets(
  allTickets: string[],
): Promise<PrioritizeResult> {
  if (allTickets.length <= 1) return fallbackResult(allTickets);

  log(
    `PRIORITIZING: ${allTickets.length} ticket(s) via jira-ticket-prioritizer skill`,
  );

  const ticketList = allTickets.join(",");
  const { code, stdout } = await runClaudeTask(
    `[GSD: prioritize ${allTickets.length} tickets] ${AUTONOMY_PREFIX}\nInvoke Skill("/jira-ticket-prioritizer ${ticketList}").\nReturn json ONLY without code fence`,
    {
      taskName: `get-shit-done: prioritizing ${allTickets.length} tickets`,
      cwd: SCRIPT_DIR,
      timeoutMs: 5 * 60 * 60 * 1000,
      model: "opus",
    },
  );

  if (code === 0) {
    try {
      const result = parsePrioritizerOutput(stdout);
      if (result) {
        logPrioritizeResult(result);
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

function logPrioritizeResult(result: PrioritizeResult): void {
  const layerSummary = result.layers
    .map((l, i) => `L${i}:[${l.group.join(",")}]`)
    .join(" ");
  log(`PRIORITIZED: ${result.layers.length} layer(s) — ${layerSummary}`);
  if (result.skipped.length > 0)
    log(`SKIPPED: ${result.skipped.map((s) => s.key).join(", ")}`);
  if (result.excluded.length > 0)
    log(`EXCLUDED: ${result.excluded.map((e) => e.key).join(", ")}`);
}

// ─── Process layers sequentially (dependency order) ──────────────────────────

async function processLayers(
  layers: GroupedLayer[],
  unprocessedSet: Set<string>,
  skippedKeys: Set<string>,
  excludedKeys: Set<string>,
  repos: string[],
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const group = filterGroup(
      layer.group,
      unprocessedSet,
      skippedKeys,
      excludedKeys,
    );
    if (group.length === 0) continue;

    log(
      `Layer ${i}: [${group.join(", ")}]${layer.relation ? ` (${layer.relation})` : ""}`,
    );

    const result = await processGroup(group, repos, layer.hasFrontend);
    succeeded += result.succeeded.length;
    failed += result.failed.length;
  }

  return { succeeded, failed };
}

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
  const { layers, skipped, excluded } = await prioritizeTickets(allKeys);

  for (const s of skipped) log(`INFO: skipping ${s.key} — ${s.reason}`);
  for (const e of excluded) log(`INFO: excluded ${e.key} — ${e.reason}`);

  const { succeeded, failed } = await processLayers(
    layers,
    new Set(unprocessed),
    new Set(skipped.map((s) => s.key)),
    new Set(excluded.map((e) => e.key)),
    repos,
  );

  log(
    `=== Summary: processed=${succeeded} skipped=${skippedCount} failed=${failed} ===`,
  );
  cleanupOldLogs(LOG_DIR, ["get-shit-done-", "task-", "group-"], 7);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
