/**
 * PIR Analyzer - Daily Post Incident Record generator
 * Runs daily at 9:00 AM via launchd
 * Analyzes PagerDuty incidents from the past 24 hours using the /pir skill
 */

import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, makeTimestamp, cleanupOldLogs } from "./lib/logger.js";
import { exec } from "./lib/exec.js";
import { spawnClaude, parseClaudeOutput, formatCost } from "./lib/claude.js";
import { parseRepos } from "./lib/repos.js";

// ─── Configuration ──────────────────────────────────────────────────────────

const REPOS = parseRepos("PIR_REPOS");
const DOMAIN = process.env.PIR_DOMAIN || "";
const ZONE_ID = process.env.PIR_ZONE_ID || "";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(SCRIPT_DIR, "logs/.pir-analyzer");
const LOG_FILE = join(LOG_DIR, `pir-analyzer-${makeTimestamp()}.log`);
const { log } = createLogger(LOG_DIR, LOG_FILE);

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log("=== PIR Analyzer started ===");
  log("Analyzing incidents from the past 24 hours");

  // Fetch latest from remote main for each repo
  log("Fetching latest remote main for all repos...");
  for (const repo of REPOS) {
    const repoName = basename(repo);
    const { ok } = await exec("git", ["fetch", "origin", "main"], { cwd: repo });
    log(ok ? `  Fetched: ${repoName}` : `  WARN: Failed to fetch ${repoName}`);
  }

  const prompt = `/pir 'the past 24 hours' ${DOMAIN}:${ZONE_ID}`;
  log("Invoking Claude CLI...");

  const { code: exitCode, stdout: claudeOutput } = await spawnClaude(
    [
      "--permission-mode", "acceptEdits",
      "--output-format", "json",
      "--add-dir", ...REPOS,
      "-p", prompt,
    ],
    { cwd: SCRIPT_DIR, taskName: "pir-analyzer", timeoutMs: 60 * 60 * 1000 },
  );

  const { costUsd, result } = parseClaudeOutput(claudeOutput);
  log(`Claude CLI exited with code: ${exitCode} (cost: ${formatCost(costUsd)})`);
  log("--- Response ---");
  log(result);
  log(`=== PIR Analyzer finished (cost: ${formatCost(costUsd)}) ===`);

  cleanupOldLogs(LOG_DIR, ["pir-analyzer-"], 30);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
