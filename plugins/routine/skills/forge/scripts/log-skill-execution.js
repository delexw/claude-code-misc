#!/usr/bin/env node
/**
 * Automatically logs Skill tool invocations to .implement-assets/execution-log.jsonl
 * Used by implement skill hooks (PreToolUse/PostToolUse matching "Skill")
 *
 * Input: JSON on stdin from Claude Code hook system
 * Output: Appends a JSON line to .implement-assets/execution-log.jsonl
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

// Always log to the root .implement-assets/ directory
const logDir = path.join(cwd, ".implement-assets");
fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, "execution-log.jsonl");
const entry = JSON.stringify({ skill: skillName, args, event, time: timestamp }) + "\n";

// Use O_APPEND | O_CREAT | O_WRONLY for atomic appends (POSIX guarantee for small writes)
const fd = fs.openSync(logFile, "a");
try {
  fs.writeSync(fd, entry);
} finally {
  fs.closeSync(fd);
}
