#!/usr/bin/env node
/**
 * Automatically logs Skill tool invocations to .implement-assets/execution-log.jsonl
 * Used by implement skill hooks (PreToolUse/PostToolUse matching "Skill")
 *
 * Input: JSON on stdin from Claude Code hook system
 * Output: Appends a JSON line to .implement-assets/<ticket>/execution-log.jsonl
 */

const fs = require("fs");
const path = require("path");

const input = JSON.parse(fs.readFileSync(0, "utf8"));

const skillName = input.tool_input?.skill ?? "unknown";
const skillArgs = input.tool_input?.args ?? "";
const eventType = input.hook_event_name;
const cwd = input.cwd;

const event = eventType === "PreToolUse" ? "start" : eventType === "PostToolUse" ? "end" : eventType;
const timestamp = new Date().toTimeString().slice(0, 8); // HH:MM:SS

// Suppress args for meta-prompter (too large), truncate others to 60 chars
const args = skillName === "meta-prompter" ? "" : skillArgs.slice(0, 60);

// Find the ticket assets dir
const assetsBase = path.join(cwd, ".implement-assets");
let logDir = assetsBase;

if (fs.existsSync(assetsBase)) {
  const subdirs = fs
    .readdirSync(assetsBase, { withFileTypes: true })
    .filter((d) => d.isDirectory());
  if (subdirs.length > 0) {
    logDir = path.join(assetsBase, subdirs[0].name);
  }
}

fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, "execution-log.jsonl");
const entry = JSON.stringify({ skill: skillName, args, event, time: timestamp });
fs.appendFileSync(logFile, entry + "\n");
