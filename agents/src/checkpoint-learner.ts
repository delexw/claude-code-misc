/**
 * Checkpoint Learner - Extract domain knowledge from checkpoint sessions into project memory
 * Runs daily at 00:00 via launchd
 */

import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createLogger, makeTimestamp, cleanupOldLogs } from "./lib/logger.js";
import { exec } from "./lib/exec.js";
import { spawnClaude } from "./lib/claude.js";
import { parseRepos, discoverRepos, repoToSlug } from "./lib/repos.js";

// ─── Configuration ──────────────────────────────────────────────────────────

const HOME = process.env.HOME!;
const CHECKPOINT_BRANCH = "entire/checkpoints/v1";
const MAX_MEMORY_LINES = 200;
const BASE_REPOS = parseRepos("CHECKPOINT_REPOS");

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(SCRIPT_DIR, "state/.checkpoint-learner");
const LOG_DIR = join(SCRIPT_DIR, "logs/.checkpoint-learner");
const LOG_FILE = join(LOG_DIR, `checkpoint-learner-${makeTimestamp()}.log`);
const PROJECTS_DIR = join(HOME, ".claude/projects");
const { log } = createLogger(LOG_DIR, LOG_FILE);

mkdirSync(STATE_DIR, { recursive: true });

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log("=== Checkpoint Learner started ===");

  let totalNew = 0;

  const REPOS = discoverRepos(BASE_REPOS);
  log(`Discovered ${REPOS.length} repo(s) (including worktrees)`);

  for (const { repo, baseRepo } of REPOS) {
    const repoName = basename(repo);
    const baseRepoName = basename(baseRepo);
    const baseRepoSlugStr = repoToSlug(baseRepo);
    const processedFile = join(STATE_DIR, `${repoName}.processed`);
    const memoryDir = join(PROJECTS_DIR, baseRepoSlugStr, "memory");
    const memoryFile = join(memoryDir, "MEMORY.md");

    log(`--- Checking repo: ${repoName} (memory -> ${baseRepoName}) ---`);

    if (!existsSync(repo)) {
      log(`SKIP: Repository directory does not exist: ${repo}`);
      continue;
    }

    const { ok: branchOk, stdout: branchOut } = await exec(
      "git", ["branch", "-a", "--list", `*${CHECKPOINT_BRANCH}*`], { cwd: repo },
    );
    if (!branchOk || !branchOut) {
      log(`SKIP: Branch '${CHECKPOINT_BRANCH}' not found in ${repoName}`);
      continue;
    }

    if (!existsSync(processedFile)) writeFileSync(processedFile, "");

    const { ok: lsOk, stdout: lsOut } = await exec(
      "git", ["ls-tree", "-r", "--name-only", CHECKPOINT_BRANCH], { cwd: repo },
    );
    if (!lsOk || !lsOut) {
      log(`SKIP: No checkpoint sessions found in ${repoName}`);
      continue;
    }

    const allSessions = lsOut
      .split("\n")
      .filter((f) => f.endsWith("metadata.json") && !/\/[0-9]+\/metadata\.json$/.test(f))
      .map((f) => f.replace(/\/metadata\.json$/, ""))
      .sort();

    if (allSessions.length === 0) {
      log(`SKIP: No checkpoint sessions found in ${repoName}`);
      continue;
    }

    const processedSet = new Set(
      readFileSync(processedFile, "utf-8").split("\n").filter(Boolean),
    );
    const unprocessed = allSessions.filter((s) => !processedSet.has(s));

    if (unprocessed.length === 0) {
      log(`All ${repoName} sessions already processed.`);
      continue;
    }

    log(`Found ${unprocessed.length} unprocessed session(s) in ${repoName}`);

    const suffix = randomBytes(3).toString("hex");
    const skillName = `checkpoint-learner-${repoName}-${suffix}`;
    const skillDir = join(HOME, ".claude/skills", skillName);
    const skillRefDir = join(skillDir, "references");
    mkdirSync(skillRefDir, { recursive: true });

    if (existsSync(memoryFile)) {
      copyFileSync(memoryFile, join(skillRefDir, "existing-memory.md"));
    } else {
      writeFileSync(join(skillRefDir, "existing-memory.md"), "[empty - file does not exist yet]");
    }

    const sessionIdsBatch: string[] = [];
    let sessionCount = 0;

    for (const sessionPath of unprocessed) {
      const { stdout: sessionMeta } = await exec(
        "git", ["show", `${CHECKPOINT_BRANCH}:${sessionPath}/metadata.json`], { cwd: repo },
      );
      const branchMatch = (sessionMeta || "{}").match(/"branch"\s*:\s*"([^"]*)"/);
      const branchName = branchMatch ? branchMatch[1] : "unknown";

      const { ok: promptsOk, stdout: promptsOut } = await exec(
        "git", ["ls-tree", "-r", "--name-only", CHECKPOINT_BRANCH, "--", sessionPath], { cwd: repo },
      );

      const promptFiles = promptsOk && promptsOut
        ? promptsOut.split("\n").filter((f) => f.endsWith("/prompt.txt")).sort()
        : [];

      if (promptFiles.length === 0) {
        appendFileSync(processedFile, sessionPath + "\n");
        continue;
      }

      sessionCount++;
      const sessionFile = join(skillRefDir, `session-${sessionCount}.md`);
      let content = `# Session: ${sessionPath} (branch: ${branchName})\n`;

      for (const promptFile of promptFiles) {
        const turnMatch = promptFile.match(/\/(\d+)\/prompt\.txt/);
        const turnNum = turnMatch ? turnMatch[1] : "?";

        const { stdout: promptText } = await exec(
          "git", ["show", `${CHECKPOINT_BRANCH}:${promptFile}`], { cwd: repo },
        );

        const contextFile = promptFile.replace(/prompt\.txt$/, "context.md");
        const { ok: ctxOk, stdout: ctxRaw } = await exec(
          "git", ["show", `${CHECKPOINT_BRANCH}:${contextFile}`], { cwd: repo },
        );
        const contextText = ctxOk && ctxRaw
          ? ctxRaw.split("\n").slice(0, 100).join("\n")
          : "";

        if (promptText) content += `\n## Turn ${turnNum} prompt\n${promptText}\n`;
        if (contextText) content += `\n## Turn ${turnNum} context (truncated)\n${contextText}\n`;
      }

      writeFileSync(sessionFile, content);
      sessionIdsBatch.push(sessionPath);

      if (sessionIdsBatch.length >= 5) break;
    }

    if (sessionCount === 0) {
      log(`No prompt content found in unprocessed sessions for ${repoName}`);
      for (const sid of sessionIdsBatch) appendFileSync(processedFile, sid + "\n");
      continue;
    }

    const sessionLinks = Array.from({ length: sessionCount }, (_, i) =>
      `  - [Session ${i + 1}](references/session-${i + 1}.md)`,
    ).join("\n");

    const skillMd = `---
name: checkpoint-learner-${repoName}
description: Extract domain knowledge from checkpoint sessions for ${baseRepoName}
allowed-tools: Read, Edit, Write, Bash(mkdir *)
context: fork
---

# Checkpoint Learner: ${baseRepoName}${repoName !== baseRepoName ? ` (from worktree: ${repoName})` : ""}

Extract valuable domain knowledge from Claude Code checkpoint sessions and write it to project memory.

## Task

Analyze the checkpoint prompts from the **${baseRepoName}** project. Extract:

1. **User corrections** — things the agent did wrong that the user had to correct
2. **Domain-specific patterns** — conventions, approaches, gotchas specific to this codebase
3. **Workflow preferences** — how the user prefers things done

## Reference Files

- **Existing memory** (for deduplication): Read [existing-memory.md](references/existing-memory.md)
- **Checkpoint sessions to analyze** (read each file):
${sessionLinks}

## Rules

- Write ONLY to this file: ${memoryFile}
- DEDUPLICATE — if the existing memory already covers a pattern, skip it
- CORRECT CONTRADICTIONS — if a new learning contradicts an existing entry, REPLACE the old entry
- Be ADDITIVE for new learnings — append under appropriate headings
- Keep entries concise (1-3 lines each) with concrete examples
- The file must stay under ${MAX_MEMORY_LINES} lines total
- If nothing genuinely new is found, output "No new learnings" and make no changes

## Output Format for MEMORY.md

If the file is new, start with:
\`\`\`markdown
# Project Memory: ${baseRepoName}
<!-- Auto-maintained by checkpoint-learner. Manual edits welcome. -->

## User Corrections
## Domain Patterns
## Workflow Preferences
\`\`\`

If the file exists, append new entries under the appropriate heading.
Ensure the memory directory exists: mkdir -p ${memoryDir}
`;

    writeFileSync(join(skillDir, "SKILL.md"), skillMd);

    log(`Invoking Claude CLI for ${repoName} (${sessionIdsBatch.length} sessions) via skill...`);

    const { code: exitCode, stdout: claudeOutput } = await spawnClaude(
      ["--permission-mode", "acceptEdits", "-p", `/${skillName}`],
      { cwd: SCRIPT_DIR, taskName: "checkpoint-learner", timeoutMs: 5 * 60 * 60 * 1000 },
    );

    log(`Claude CLI exited with code: ${exitCode}`);
    if (claudeOutput) log(`--- Response ---\n${claudeOutput}`);

    try {
      rmSync(skillDir, { recursive: true, force: true });
      log(`Cleaned up skill directory: ${skillDir}`);
    } catch (err: unknown) {
      log(`WARN: Failed to clean up skill directory: ${(err as Error).message}`);
    }

    for (const sid of sessionIdsBatch) appendFileSync(processedFile, sid + "\n");
    totalNew += sessionIdsBatch.length;
    log(`Marked ${sessionIdsBatch.length} session(s) as processed for ${repoName}`);

    if (existsSync(memoryFile)) {
      const lines = readFileSync(memoryFile, "utf-8").split("\n");
      if (lines.length > MAX_MEMORY_LINES) {
        log(`WARNING: MEMORY.md has ${lines.length} lines (limit: ${MAX_MEMORY_LINES}). Truncating.`);
        writeFileSync(memoryFile, lines.slice(0, MAX_MEMORY_LINES).join("\n"));
      }
    }
  }

  log(`=== Checkpoint Learner finished (processed ${totalNew} new sessions) ===`);
  cleanupOldLogs(LOG_DIR, ["checkpoint-learner-"], 30);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
