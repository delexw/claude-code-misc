/**
 * parse-pd.js — Parsers that extract only essential fields from
 * PagerDuty CLI JSON output to reduce token and context usage.
 */

function parseJsonFromPdOutput(raw) {
  const jsonStart =
    raw.indexOf("[") !== -1 &&
    (raw.indexOf("{") === -1 || raw.indexOf("[") < raw.indexOf("{"))
      ? raw.indexOf("[")
      : raw.indexOf("{");
  if (jsonStart === -1) throw new Error("No JSON found in pd output");
  return JSON.parse(raw.slice(jsonStart));
}

function asArray(data) {
  return Array.isArray(data) ? data : [data];
}

const parsers = {
  ep(data) {
    return asArray(data).map((ep) => ({
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
    return asArray(data).map((inc) => ({
      id: inc.id,
      incident_number: inc.incident_number,
      title: inc.title ?? inc.summary,
      status: inc.status,
      urgency: inc.urgency,
      created_at: inc.created_at ?? null,
      resolved_at: inc.resolved_at ?? null,
      service: inc.service
        ? { id: inc.service.id, name: inc.service.summary ?? inc.service.name }
        : null,
      escalation_policy: inc.escalation_policy
        ? {
            id: inc.escalation_policy.id,
            name: inc.escalation_policy.summary ?? inc.escalation_policy.name,
          }
        : null,
      assigned_to: (inc.assignments ?? []).map(
        (a) => a.assignee?.summary ?? a.assignee?.name ?? "unknown"
      ),
      alert_counts: inc.alert_counts ?? null,
    }));
  },

  log(data) {
    return asArray(data).map((entry) => ({
      type: entry.type,
      created_at: entry.created_at ?? null,
      channel: entry.channel?.type ?? null,
      agent: entry.agent?.summary ?? entry.agent?.name ?? null,
      note: entry.channel?.summary ?? entry.channel?.subject ?? null,
    }));
  },

  notes(data) {
    return asArray(data).map((note) => ({
      id: note.id,
      content: note.content,
      created_at: note.created_at ?? null,
      user: note.user?.summary ?? note.user?.name ?? null,
    }));
  },

  analytics(data) {
    return asArray(data).map((a) => ({
      incident_id: a.incident_id ?? a.id,
      mean_seconds_to_resolve:
        a.mean_seconds_to_resolve ?? a.seconds_to_resolve ?? null,
      mean_seconds_to_first_ack:
        a.mean_seconds_to_first_ack ?? a.seconds_to_first_ack ?? null,
      mean_seconds_to_engage:
        a.mean_seconds_to_engage ?? a.seconds_to_engage ?? null,
      mean_seconds_to_mobilize:
        a.mean_seconds_to_mobilize ?? a.seconds_to_mobilize ?? null,
      escalation_count: a.escalation_count ?? a.num_escalations ?? null,
      timeout_escalation_count: a.timeout_escalation_count ?? null,
      num_interruptions: a.num_interruptions ?? null,
    }));
  },
};

module.exports = { parsers, parseJsonFromPdOutput };
