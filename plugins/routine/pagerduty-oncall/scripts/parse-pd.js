#!/usr/bin/env node
/**
 * Parse PagerDuty CLI JSON output and extract only essential fields
 * to reduce token and context usage.
 *
 * Usage: pd <command> --json | node parse-pd.js <type>
 *
 * Types:
 *   ep          - Escalation policies
 *   incident    - Incident list
 *   log         - Incident log entries
 *   notes       - Incident notes
 *   analytics   - Incident analytics
 */

const type = process.argv[2];

if (!type) {
  console.error("Usage: node parse-pd.js <ep|incident|log|notes|analytics>");
  process.exit(1);
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    // Strip non-JSON prefix (e.g. progress messages like "Getting escalation policies...")
    const jsonStart = input.indexOf("[") !== -1 && (input.indexOf("{") === -1 || input.indexOf("[") < input.indexOf("{"))
      ? input.indexOf("[")
      : input.indexOf("{");
    if (jsonStart === -1) throw new Error("No JSON found in input");
    const cleaned = input.slice(jsonStart);
    const data = JSON.parse(cleaned);
    const result = parsers[type]?.(data);
    if (!result) {
      console.error(`Unknown type: ${type}`);
      process.exit(1);
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(`Failed to parse JSON: ${e.message}`);
    process.exit(1);
  }
});

const parsers = {
  ep(data) {
    const items = Array.isArray(data) ? data : [data];
    return items.map((ep) => ({
      id: ep.id,
      name: ep.name ?? ep.summary,
      num_loops: ep.num_loops,
      services: (ep.services ?? []).map((s) => ({
        id: s.id,
        name: s.summary ?? s.name,
      })),
    }));
  },

  incident(data) {
    const items = Array.isArray(data) ? data : [data];
    return items.map((inc) => ({
      id: inc.id,
      incident_number: inc.incident_number,
      title: inc.title ?? inc.summary,
      status: inc.status,
      urgency: inc.urgency,
      created_at: inc.created_at,
      resolved_at: inc.resolved_at ?? null,
      service: inc.service
        ? { id: inc.service.id, name: inc.service.summary ?? inc.service.name }
        : null,
      escalation_policy: inc.escalation_policy
        ? {
            id: inc.escalation_policy.id,
            name:
              inc.escalation_policy.summary ?? inc.escalation_policy.name,
          }
        : null,
      assigned_to: (inc.assignments ?? []).map(
        (a) => a.assignee?.summary ?? a.assignee?.name ?? "unknown"
      ),
      alert_counts: inc.alert_counts ?? null,
    }));
  },

  log(data) {
    const items = Array.isArray(data) ? data : [data];
    return items.map((entry) => ({
      type: entry.type,
      created_at: entry.created_at,
      channel: entry.channel?.type ?? null,
      agent: entry.agent?.summary ?? entry.agent?.name ?? null,
      note: entry.channel?.summary ?? entry.channel?.subject ?? null,
    }));
  },

  notes(data) {
    const items = Array.isArray(data) ? data : [data];
    return items.map((note) => ({
      id: note.id,
      content: note.content,
      created_at: note.created_at,
      user: note.user?.summary ?? note.user?.name ?? null,
    }));
  },

  analytics(data) {
    const items = Array.isArray(data) ? data : [data];
    return items.map((a) => ({
      incident_id: a.incident_id ?? a.id,
      mean_seconds_to_resolve: a.mean_seconds_to_resolve ?? a.seconds_to_resolve ?? null,
      mean_seconds_to_first_ack: a.mean_seconds_to_first_ack ?? a.seconds_to_first_ack ?? null,
      mean_seconds_to_engage: a.mean_seconds_to_engage ?? a.seconds_to_engage ?? null,
      mean_seconds_to_mobilize: a.mean_seconds_to_mobilize ?? a.seconds_to_mobilize ?? null,
      escalation_count: a.escalation_count ?? a.num_escalations ?? null,
      timeout_escalation_count: a.timeout_escalation_count ?? null,
      num_interruptions: a.num_interruptions ?? null,
    }));
  },
};
