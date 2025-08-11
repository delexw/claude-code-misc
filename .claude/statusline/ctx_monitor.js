#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

// --- input ---
const input = readJSON(0); // stdin
const transcript = input.transcript_path;
const sessionId = input.session_id;
const model = input.model ?? {};
const name = `\x1b[95m${String(model.display_name ?? '').trim()}\x1b[0m`;
const CONTEXT_WINDOW = 200_000;
const fmt = new Intl.NumberFormat('en-US');

// --- helpers (built-ins only) ---
function readJSON(fd) {
  try { return JSON.parse(fs.readFileSync(fd, 'utf8')); } catch { return {}; }
}
const color = p => (p >= 90 ? '\x1b[31m' : p >= 70 ? '\x1b[33m' : '\x1b[32m'); // red/yellow/green
const comma = n => fmt.format(Math.max(0, Math.floor(Number(n) || 0)));
const usedTotal = u =>
  (u?.input_tokens ?? 0) +
  (u?.output_tokens ?? 0) +
  (u?.cache_read_input_tokens ?? 0) +
  (u?.cache_creation_input_tokens ?? 0);

const syntheticModel = j => {
  const m = String(j?.message?.model ?? '').toLowerCase();
  return m === '<synthetic>' || m.includes('synthetic');
};
const contentNoResponse = j => {
  const c = j?.message?.content;
  return Array.isArray(c) && c.some(x => x?.type === 'text' && /no\s+response\s+requested/i.test(String(x.text)));
};

function lastMainUsage() {
  if (!transcript) return null;
  try {
    const lines = fs.readFileSync(transcript, 'utf8').split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      let j; try { j = JSON.parse(line); } catch { continue; }

      const side = j.isSidechain;
      if (!(side === false || side === 'false' || side === 0 || side === '0')) continue; // main ctx only

      const u = j.usage ?? j.message?.usage;
      if (!u || typeof u !== 'object') continue;
      if (syntheticModel(j) || j.isApiErrorMessage === true || usedTotal(u) === 0 || contentNoResponse(j)) continue;

      return u; // last real usage line
    }
  } catch { /* ignore */ }
  return null;
}

// --- compute/print ---
const usage = lastMainUsage();

if (!usage) {
  console.log(`[${name}] \x1b[36mcontext window usage starts after your first question.\x1b[0m [\x1b[90m${sessionId}\x1b[0m]`);
  process.exit(0);
}

const used = usedTotal(usage);
const pct = CONTEXT_WINDOW > 0 ? Math.floor((used * 100) / CONTEXT_WINDOW) : 0;

const usagePercentLabel = `${color(pct)}context window usage ${pct}%\x1b[0m`;
const usageCountLabel = `\x1b[33m(${comma(used)}/${comma(CONTEXT_WINDOW)})\x1b[0m`;
const sessionLabel = `[\x1b[90m${sessionId}\x1b[0m]`;

console.log(`[${name}]  ${usagePercentLabel}  ${usageCountLabel} ${sessionLabel}`);