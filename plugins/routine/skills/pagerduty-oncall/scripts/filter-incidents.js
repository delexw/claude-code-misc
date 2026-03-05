#!/usr/bin/env node
// Filters incidents by service IDs derived from ep-list.json and extracts relevant fields.
// Usage: cat raw-incidents.json | node filter-incidents.js <ep-list.json-path>
// Collects all service IDs from the EPs' services arrays and matches against incident service.id.
// If no services found in ep-list.json, all incidents pass through.
// Outputs filtered JSON array to stdout.

const fs = require("fs");
const epListPath = process.argv[2];

if (!epListPath) {
  process.stderr.write("Usage: cat raw-incidents.json | node filter-incidents.js <ep-list.json>\n");
  process.exit(1);
}

const epList = JSON.parse(fs.readFileSync(epListPath, "utf8"));
const serviceIds = new Set(
  epList.flatMap((ep) => (ep.services || []).map((s) => s.id))
);

const chunks = [];
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const incidents = JSON.parse(chunks.join(""));

  const filtered = serviceIds.size > 0
    ? incidents.filter((inc) => {
        const svcId = inc.service?.id || inc.service?.self?.match(/\/([^/]+)$/)?.[1];
        return serviceIds.has(svcId);
      })
    : incidents;

  const extracted = filtered.map((inc) => ({
    id: inc.id,
    incident_number: inc.incident_number,
    title: inc.title,
    status: inc.status,
    urgency: inc.urgency,
    created_at: inc.created_at,
    resolved_at: inc.resolved_at || null,
    service: {
      id: inc.service?.id,
      name: inc.service?.summary || inc.service?.name,
    },
    escalation_policy: {
      id: inc.escalation_policy?.id,
      name: inc.escalation_policy?.summary || inc.escalation_policy?.name,
    },
    assigned_to: (inc.assignments || []).map(
      (a) => a.assignee?.summary || a.assignee?.name || "unknown"
    ),
    alert_counts: inc.alert_counts || { all: 0, triggered: 0, resolved: 0 },
  }));

  process.stdout.write(JSON.stringify(extracted, null, 2) + "\n");
});
