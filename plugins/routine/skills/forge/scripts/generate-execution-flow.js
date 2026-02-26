#!/usr/bin/env node
/**
 * Generates a Mermaid Gantt chart from execution-log.jsonl
 * Called by implement skill Stop hook (once: true)
 *
 * Input: JSON on stdin from Claude Code hook system
 * Output: Creates execution-flow.md in the ticket assets directory
 */

const fs = require("fs");
const path = require("path");

const input = JSON.parse(fs.readFileSync(0, "utf8"));
const cwd = input.cwd;

// Read from the root .implement-assets/ directory
const assetsBase = path.join(cwd, ".implement-assets");
const logFile = path.join(assetsBase, "execution-log.jsonl");

if (!fs.existsSync(logFile)) process.exit(0);

// Derive ticket ID from the first subdirectory (ticket assets dir)
const subdirs = fs
  .readdirSync(assetsBase, { withFileTypes: true })
  .filter((d) => d.isDirectory());
const ticketId = subdirs.length > 0 ? subdirs[0].name : "unknown";

// Parse JSONL into entries
const raw = fs.readFileSync(logFile, "utf8").trim();
if (!raw) process.exit(0);

const entries = raw.split("\n").map((line) => JSON.parse(line));

// Pair start/end events by skill+args key
const startMap = new Map();
const tasks = [];

function timeToSeconds(t) {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

for (const entry of entries) {
  const key = `${entry.skill}|${entry.args}`;

  if (entry.event === "start") {
    startMap.set(key, entry.time);
  } else if (entry.event === "end") {
    const startTime = startMap.get(key) ?? entry.time;
    let duration = timeToSeconds(entry.time) - timeToSeconds(startTime);
    if (duration < 1) duration = 1;

    // Extract a short label from args (first arg, e.g. domain name or ticket key)
    let firstArg = (entry.args || "").split(" ")[0];
    // Truncate long args (e.g. URLs) to keep chart readable
    if (firstArg.length > 20) firstArg = firstArg.slice(0, 20) + "...";
    const label = firstArg ? `${entry.skill} (${firstArg})` : entry.skill;
    tasks.push({ label, start: startTime, duration });
    startMap.delete(key);
  }
}

if (tasks.length === 0) process.exit(0);

// Detect parallel batch: tasks sharing the same start time
const timeCount = new Map();
for (const t of tasks) {
  timeCount.set(t.start, (timeCount.get(t.start) ?? 0) + 1);
}

const parallelTimes = new Set(
  [...timeCount.entries()]
    .filter(([, count]) => count > 1)
    .map(([time]) => time)
);

// Generate Mermaid Gantt chart
const lines = [
  `# Execution Flow — ${ticketId}`,
  "",
  "```mermaid",
  "gantt",
  `    title Implement Execution Flow — ${ticketId}`,
  "    dateFormat HH:mm:ss",
  "    axisFormat %H:%M:%S",
  "",
];

let currentSection = "";

tasks.forEach((t, i) => {
  const isParallel = parallelTimes.has(t.start);
  const section = isParallel ? "parallel" : "sequential";

  if (section !== currentSection) {
    lines.push(
      isParallel
        ? "    section Parallel Batch (P3+P4)"
        : "    section Sequential"
    );
    currentSection = section;
  }

  lines.push(`    ${t.label}   :t${i}, ${t.start}, ${t.duration}s`);
});

lines.push("```", "");

const outFile = path.join(assetsBase, "execution-flow.md");
fs.writeFileSync(outFile, lines.join("\n"));

// Print to stdout so it appears in the conversation
console.log(lines.join("\n"));
