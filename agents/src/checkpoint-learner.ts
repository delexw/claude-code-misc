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
  readdirSync,
} from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createLogger, makeTimestamp, cleanupOldLogs } from "./lib/logger.js";
import { exec } from "./lib/exec.js";
import { spawnClaude } from "./lib/claude.js";
import { parseRepos, repoToSlug } from "./lib/repos.js";

// ─── Configuration ──────────────────────────────────────────────────────────

const HOME = process.env.HOME!;
const CHECKPOINT_BRANCH = "entire/checkpoints/v1";
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

  // Only scan base repos — worktrees share the same checkpoint branch,
  // so scanning them separately is redundant and wastes time.
  const REPOS = BASE_REPOS.filter((r) => existsSync(r));
  log(`Scanning ${REPOS.length} base repo(s) (worktrees skipped — shared checkpoint branch)`);

  for (const repo of REPOS) {
    const baseRepo = repo;
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

    // Copy MEMORY.md and all existing topic files as references for deduplication
    const existingTopicFiles: string[] = [];
    if (existsSync(memoryFile)) {
      copyFileSync(memoryFile, join(skillRefDir, "existing-memory.md"));
    } else {
      writeFileSync(join(skillRefDir, "existing-memory.md"), "[empty - file does not exist yet]");
    }
    if (existsSync(memoryDir)) {
      for (const f of readdirSync(memoryDir)) {
        if (f === "MEMORY.md" || !f.endsWith(".md")) continue;
        copyFileSync(join(memoryDir, f), join(skillRefDir, `topic-${f}`));
        existingTopicFiles.push(f);
      }
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

    const existingTopicLinks = existingTopicFiles.length > 0
      ? existingTopicFiles.map((f) => `  - [${f}](references/topic-${f})`).join("\n")
      : "  - (none)";

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

- **Existing MEMORY.md index** (for deduplication): Read [existing-memory.md](references/existing-memory.md)
- **Existing topic files** (read each for deduplication):
${existingTopicLinks}
- **Checkpoint sessions to analyze** (read each file):
${sessionLinks}

## Memory Structure

The memory directory uses **topic files** — each learning is a separate .md file with YAML frontmatter.
\`MEMORY.md\` is a **concise index** (under 200 lines) that links to topic files with brief descriptions.

### Topic file format

Each topic file in \`${memoryDir}/\` follows this format:

\`\`\`markdown
---
name: {{short descriptive name}}
description: {{one-line description — used to decide relevance in future conversations}}
type: {{user | feedback | project | reference}}
---

{{content body — concise, actionable, with concrete examples}}

**Why:** {{reason the user gave or context behind this learning}}

**How to apply:** {{when/where this guidance kicks in}}
\`\`\`

### Type definitions

- **user** — info about the user's role, preferences, knowledge (e.g., "senior Rails dev, new to React")
- **feedback** — corrections or guidance the user gave (e.g., "don't mock the database in tests")
- **project** — ongoing work, goals, decisions not derivable from code/git (e.g., "merge freeze after Thursday")
- **reference** — pointers to external resources (e.g., "pipeline bugs tracked in Linear project INGEST")

### Naming convention

File names: \`{type}_{descriptive_slug}.md\` (e.g., \`feedback_no_easy_fixes.md\`, \`project_auth_rewrite.md\`)

## Rules

- Write topic files to: \`${memoryDir}/\`
- Update the MEMORY.md index at: \`${memoryFile}\`
- Ensure the memory directory exists: \`mkdir -p ${memoryDir}\`
- **DEDUPLICATE** — read ALL existing topic files first. If an existing topic already covers a learning, skip it.
- **CORRECT CONTRADICTIONS** — if a new learning contradicts an existing topic file, UPDATE that file (newer wins).
- **MERGE related learnings** — if a new learning extends an existing topic, update that topic file rather than creating a new one.
- Be ADDITIVE for genuinely new learnings — create a new topic file and add an index entry.
- Keep each topic file focused on ONE concept (1-15 lines of content after frontmatter).
- Keep MEMORY.md as a concise index (links + one-line descriptions). Do NOT put detailed content in MEMORY.md.
- If nothing genuinely new is found, output "No new learnings" and make no changes.

## MEMORY.md Index Format

\`\`\`markdown
# Project Memory: ${baseRepoName}

## User
- [user_topic.md](user_topic.md) — Brief description

## Feedback
- [feedback_topic.md](feedback_topic.md) — Brief description

## Project
- [project_topic.md](project_topic.md) — Brief description

## Reference
- [reference_topic.md](reference_topic.md) — Brief description

## Domain Patterns
- [domain_topic.md](domain_topic.md) — Brief description

## Workflow Preferences
- [workflow_topic.md](workflow_topic.md) — Brief description
\`\`\`

If the MEMORY.md file exists with inline content (not links), migrate those entries into topic files
and replace the inline content with index links. Only include sections that have entries.
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
  }

  log(`=== Checkpoint Learner finished (processed ${totalNew} new sessions) ===`);
  cleanupOldLogs(LOG_DIR, ["checkpoint-learner-"], 30);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
