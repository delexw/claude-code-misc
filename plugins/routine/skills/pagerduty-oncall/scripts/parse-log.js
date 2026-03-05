#!/usr/bin/env node
// Extracts relevant fields from incident log entries.
// Usage: cat raw-log.json | node parse-log.js
// Outputs extracted JSON array to stdout.

const chunks = [];
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const entries = JSON.parse(chunks.join(""));

  const extracted = (Array.isArray(entries) ? entries : []).map((entry) => ({
    type: entry.type,
    created_at: entry.created_at,
    channel: entry.channel?.type || entry.channel || null,
    agent: entry.agent?.summary || entry.agent?.name || null,
    note: entry.contexts?.[0]?.text || entry.note?.content || null,
  }));

  process.stdout.write(JSON.stringify(extracted, null, 2) + "\n");
});
