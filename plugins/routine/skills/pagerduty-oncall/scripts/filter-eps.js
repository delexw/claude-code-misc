#!/usr/bin/env node
// Filters escalation policies by target names and extracts relevant fields.
// Usage: cat raw-eps.json | node filter-eps.js ["name1" "name2" ...]
// If no names provided, all EPs pass through (no filtering).
// Outputs filtered JSON array to stdout.

const targetNames = process.argv.slice(2).map((n) => n.toLowerCase());

const chunks = [];
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const eps = JSON.parse(chunks.join(""));

  let filtered = eps;
  if (targetNames.length > 0) {
    filtered = eps.filter((ep) =>
      targetNames.some((t) => (ep.name || "").toLowerCase().includes(t))
    );
  }

  const extracted = filtered.map((ep) => ({
    id: ep.id,
    name: ep.name,
    num_loops: ep.num_loops,
    services: (ep.services || []).map((s) => ({ id: s.id, name: s.summary || s.name })),
  }));

  process.stdout.write(JSON.stringify(extracted, null, 2) + "\n");
});
