#!/usr/bin/env node
// Extracts relevant fields from incident analytics.
// Usage: cat raw-analytics.json | node parse-analytics.js
// Outputs extracted JSON object to stdout.

const chunks = [];
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const data = JSON.parse(chunks.join(""));

  // Analytics may be a single object or an array with one element
  const src = Array.isArray(data) ? data[0] || {} : data;

  const extracted = {
    seconds_to_resolve: src.seconds_to_resolve ?? src.mean_seconds_to_resolve ?? null,
    seconds_to_first_ack: src.seconds_to_first_ack ?? src.mean_seconds_to_first_ack ?? null,
    seconds_to_engage: src.seconds_to_engage ?? src.mean_seconds_to_engage ?? null,
    seconds_to_mobilize: src.seconds_to_mobilize ?? src.mean_seconds_to_mobilize ?? null,
    escalation_count: src.escalation_count ?? null,
    timeout_escalation_count: src.timeout_escalation_count ?? null,
    total_interruptions: src.total_interruptions ?? src.num_interruptions ?? null,
  };

  process.stdout.write(JSON.stringify(extracted, null, 2) + "\n");
});
