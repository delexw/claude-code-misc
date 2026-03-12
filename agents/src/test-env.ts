/**
 * Test script - verifies env vars are loaded correctly via launchd .envrc sourcing.
 * Also spawns a minimal Claude CLI session to verify the SessionEnd hook fires.
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, makeTimestamp } from "./lib/logger.js";
import { spawnClaude } from "./lib/claude.js";

const HOME = process.env.HOME!;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(SCRIPT_DIR, "logs/.test-env");
const { log } = createLogger(LOG_DIR, join(LOG_DIR, `test-env-${makeTimestamp()}.log`));

// ─── Required env vars per agent ────────────────────────────────────────────

const ENV_CHECKS: Record<string, string[]> = {
  "pir-analyzer": ["PIR_REPOS", "PIR_DOMAIN", "PIR_ZONE_ID"],
  "get-shit-done": ["JIRA_SERVER", "JIRA_ASSIGNEE", "JIRA_SPRINT_PREFIX", "GSD_REPOS"],
  "checkpoint-learner": ["CHECKPOINT_REPOS"],
  "memory-synthesizer": ["MEMORY_REPOS"],
};

async function main() {
  log("=== Environment Variable Test ===");
  log(`HOME=${HOME}`);
  log(`SCRIPT_DIR=${SCRIPT_DIR}`);
  log(`CLAUDE_SCHEDULER_TASK=${process.env.CLAUDE_SCHEDULER_TASK || "<unset>"}`);
  log(`NTFY_TOPIC=${process.env.NTFY_TOPIC || "<unset>"}`);
  log("");

  let allPassed = true;

  for (const [agent, vars] of Object.entries(ENV_CHECKS)) {
    log(`--- ${agent} ---`);
    for (const v of vars) {
      const val = process.env[v];
      if (val) {
        log(`  OK: ${v}=${val.length > 50 ? val.slice(0, 50) + "..." : val}`);
      } else {
        log(`  MISSING: ${v}`);
        allPassed = false;
      }
    }
  }

  log("");
  log(allPassed ? "All env vars present." : "Some env vars are MISSING. Check .envrc.");

  // Test Claude CLI + SessionEnd hook
  log("");
  log("--- Testing Claude CLI + SessionEnd hook ---");

  const { code, stdout } = await spawnClaude(
    ["--permission-mode", "acceptEdits", "-p", "Reply with just: test-env OK"],
    { cwd: SCRIPT_DIR, taskName: "test-env", timeoutMs: 60_000 },
  );

  log(`Claude CLI exit=${code}`);
  log(`Response: ${stdout}`);
  log("");
  log("If you received an ntfy notification, the SessionEnd hook works.");
  log("=== Test complete ===");
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
