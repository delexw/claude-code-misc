#!/usr/bin/env node
"use strict";

const fs = require("fs");

// --- input ---
const input = readJSON(0); // stdin
const sessionId = `\x1b[90m${String(input.session_id ?? "")}\x1b[0m`;
const transcript = input.transcript_path;
const model = input.model || {};
const name = `\x1b[95m${String(model.display_name ?? "")}\x1b[0m`.trim();
const CONTEXT_WINDOW = 200_000;

// --- helpers ---
function readJSON(fd) {
  try {
    return JSON.parse(fs.readFileSync(fd, "utf8"));
  } catch {
    return {};
  }
}
function color(p) {
  if (p >= 90) return "\x1b[31m"; // red
  if (p >= 70) return "\x1b[33m"; // yellow
  return "\x1b[32m"; // green
}
const comma = (n) =>
  new Intl.NumberFormat("en-US").format(
    Math.max(0, Math.floor(Number(n) || 0))
  );

function usedTotal(u) {
  return (
    (u?.input_tokens ?? 0) +
    (u?.output_tokens ?? 0) +
    (u?.cache_read_input_tokens ?? 0) +
    (u?.cache_creation_input_tokens ?? 0)
  );
}

function syntheticModel(j) {
  const m = String(j?.message?.model ?? "").toLowerCase();
  return m === "<synthetic>" || m.includes("synthetic");
}

function assistantMessage(j) {
  return j?.message?.role === "assistant";
}

function subContext(j) {
  return j?.isSidechain === true;
}

function contentNoResponse(j) {
  const c = j?.message?.content;
  return (
    Array.isArray(c) &&
    c.some(
      (x) =>
        x &&
        x.type === "text" &&
        /no\s+response\s+requested/i.test(String(x.text))
    )
  );
}

function parseTs(j) {
  const t = j?.timestamp;
  const n = Date.parse(t);
  return Number.isFinite(n) ? n : -Infinity;
}

// Find the newest main-context entry by timestamp (not file order)
function newestMainUsageByTimestamp() {
  if (!transcript) return null;
  let latestTs = -Infinity;
  let latestUsage = null;

  let lines;
  try {
    lines = fs.readFileSync(transcript, "utf8").split(/\r?\n/);
  } catch {
    return null;
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;

    let j;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    const u = j.message?.usage;
    if (
      subContext(j) ||
      syntheticModel(j) ||
      j.isApiErrorMessage === true ||
      usedTotal(u) === 0 ||
      contentNoResponse(j) ||
      !assistantMessage(j)
    )
      continue;

    const ts = parseTs(j);
    if (ts > latestTs) {
      latestTs = ts;
      latestUsage = u;
    }
    else if (ts == latestTs && usedTotal(u) > usedTotal(latestUsage)) {
      latestUsage = u;
    }
  }
  return latestUsage;
}

// --- compute/print ---
const usage = newestMainUsageByTimestamp();
if (!usage) {
  console.log(
    `${name} | \x1b[36mcontext window usage starts after your first question.\x1b[0m\nsession: ${sessionId}`
  );
  process.exit(0);
}

const used = usedTotal(usage);
const pct = CONTEXT_WINDOW > 0 ? Math.floor((used * 100) / CONTEXT_WINDOW) : 0;

const usagePercentLabel = `${color(pct)}context used ${pct}%\x1b[0m`;
const usageCountLabel = `\x1b[33m(${comma(used)}/${comma(
  CONTEXT_WINDOW
)})\x1b[0m`;

console.log(
  `${name} | ${usagePercentLabel} - ${usageCountLabel}\nsession: ${sessionId}`
);
