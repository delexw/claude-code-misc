/**
 * Memory Synthesizer - Extract common patterns from project-level MEMORY.md into global CLAUDE.md
 * Runs weekly (Sunday 01:00) via launchd
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createLogger, makeTimestamp, cleanupOldLogs } from "./lib/logger.js";
import { spawnClaude } from "./lib/claude.js";
import { parseRepos, repoToSlug } from "./lib/repos.js";

// ─── Configuration ──────────────────────────────────────────────────────────

const HOME = process.env.HOME!;
const PROJECTS_DIR = join(HOME, ".claude/projects");
const CLAUDE_MD = join(HOME, ".claude/CLAUDE.md");
const BASE_REPOS = parseRepos("MEMORY_REPOS");

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(SCRIPT_DIR, "logs/.memory-synthesizer");
const LOG_FILE = join(LOG_DIR, `memory-synthesizer-${makeTimestamp()}.log`);
const { log } = createLogger(LOG_DIR, LOG_FILE);

// ─── Discover project memory files ──────────────────────────────────────────

interface MemoryFileInfo {
  repo: string;
  repoName: string;
  slug: string;
  path: string;
  content: string;
}

function discoverMemoryFiles(): MemoryFileInfo[] {
  const files: MemoryFileInfo[] = [];
  for (const repo of BASE_REPOS) {
    const slug = repoToSlug(repo);
    const memoryFile = join(PROJECTS_DIR, slug, "memory", "MEMORY.md");
    if (existsSync(memoryFile)) {
      const content = readFileSync(memoryFile, "utf-8").trim();
      if (content) {
        files.push({ repo, repoName: basename(repo), slug, path: memoryFile, content });
      }
    }
  }
  return files;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log("=== Memory Synthesizer started ===");

  const memoryFiles = discoverMemoryFiles();

  if (memoryFiles.length < 2) {
    log(`Only ${memoryFiles.length} project memory file(s) found. Need at least 2. Exiting.`);
    return;
  }

  log(`Found ${memoryFiles.length} project memory file(s):`);
  for (const f of memoryFiles) {
    log(`  - ${f.repoName}: ${f.path} (${f.content.split("\n").length} lines)`);
  }

  const suffix = randomBytes(3).toString("hex");
  const skillName = `memory-synthesizer-${suffix}`;
  const skillDir = join(HOME, ".claude/skills", skillName);
  const skillRefDir = join(skillDir, "references");
  mkdirSync(skillRefDir, { recursive: true });

  if (existsSync(CLAUDE_MD)) {
    copyFileSync(CLAUDE_MD, join(skillRefDir, "existing-claude-md.md"));
  } else {
    writeFileSync(join(skillRefDir, "existing-claude-md.md"), "[empty - file does not exist yet]");
  }

  const memoryRefLinks: string[] = [];
  for (const f of memoryFiles) {
    const refName = `project-memory-${f.repoName}.md`;
    copyFileSync(f.path, join(skillRefDir, refName));
    memoryRefLinks.push(`  - **${f.repoName}**: [${refName}](references/${refName}) → \`${f.path}\``);
  }

  const filePathMapping = memoryFiles
    .map((f) => `  - ${f.repoName}: ${f.path}`)
    .join("\n");

  const skillMd = `---
name: memory-synthesizer
description: Synthesize project-level memories into global CLAUDE.md
allowed-tools: Read, Edit, Write, Bash(mkdir *)
context: fork
---

# Memory Synthesizer

Analyze all project-level MEMORY.md files. Extract patterns that appear across 2+ projects
into the global CLAUDE.md, then remove those promoted entries from project-level files.

## Task

You have ${memoryFiles.length} project memory files and the global CLAUDE.md to work with.

### Step 1: Read all reference files
- Read [existing-claude-md.md](references/existing-claude-md.md)
${memoryRefLinks.join("\n")}

### Step 2: Identify cross-project patterns
Find entries in **2 or more** project memory files. Be CONSERVATIVE — only promote genuinely
cross-project patterns, not framework-specific ones.

### Step 3: Update global CLAUDE.md
- File: ${CLAUDE_MD}
- Add under \`## Learned Preferences\` (create if needed)
- DEDUPLICATE and CORRECT CONTRADICTIONS (newer wins)

### Step 4: Remove promoted entries from project files
${filePathMapping}

### Step 5: Output summary

## Rules
- Be CONSERVATIVE — when in doubt, leave entries in project files
- An entry must appear in 2+ project files to qualify
- Don't promote framework-specific patterns
- Keep CLAUDE.md organized and concise
- Preserve all existing CLAUDE.md content
`;

  writeFileSync(join(skillDir, "SKILL.md"), skillMd);

  log(`Invoking Claude CLI via skill /${skillName}...`);

  const { code: exitCode, stdout: claudeOutput } = await spawnClaude(
    ["--permission-mode", "acceptEdits", "-p", `/${skillName}`],
    { cwd: SCRIPT_DIR, taskName: "memory-synthesizer", timeoutMs: 5 * 60 * 60 * 1000 },
  );

  log(`Claude CLI exited with code: ${exitCode}`);
  if (claudeOutput) log(`--- Response ---\n${claudeOutput}`);

  try {
    rmSync(skillDir, { recursive: true, force: true });
    log(`Cleaned up skill directory: ${skillDir}`);
  } catch (err: unknown) {
    log(`WARN: Failed to clean up skill directory: ${(err as Error).message}`);
  }

  log("=== Memory Synthesizer finished ===");
  cleanupOldLogs(LOG_DIR, ["memory-synthesizer-"], 30);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
