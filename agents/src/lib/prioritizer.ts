/**
 * Prioritizer: parsing, filtering, and ticket prioritization via Claude.
 */

import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import { AUTONOMY_PREFIX } from "./prompts.js";

export interface GroupedLayer {
  group: string[];
  relation: string | null;
  hasFrontend: boolean;
}

export interface PrioritizeResult {
  layers: GroupedLayer[];
  skipped: Array<{ key: string; reason: string }>;
  excluded: Array<{ key: string; reason: string }>;
}

export interface SprintTicket {
  key: string;
  status: string;
}

function toKeyReasonArray(arr: unknown[]): Array<{ key: string; reason: string }> {
  return arr.filter(
    (item): item is { key: string; reason: string } =>
      typeof item === "object" &&
      item !== null &&
      "key" in item &&
      typeof item.key === "string" &&
      "reason" in item &&
      typeof item.reason === "string",
  );
}

/**
 * Parse raw prioritizer JSON output into a typed PrioritizeResult.
 * Handles both new grouped format and legacy array-of-arrays format.
 * Returns null if parsing fails.
 */
export function parsePrioritizerOutput(raw: string): PrioritizeResult | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");
  const parsed: unknown = JSON.parse(cleaned);

  if (typeof parsed !== "object" || parsed === null) return null;
  if (!("layers" in parsed) || !Array.isArray(parsed.layers) || parsed.layers.length === 0)
    return null;

  const layers: GroupedLayer[] = parsed.layers.map((l: unknown) => {
    if (Array.isArray(l)) {
      return {
        group: l.filter((x): x is string => typeof x === "string"),
        relation: null,
        hasFrontend: true,
      };
    }
    if (typeof l === "object" && l !== null) {
      const group =
        "group" in l && Array.isArray(l.group)
          ? l.group.filter((x): x is string => typeof x === "string")
          : [];
      const relation = "relation" in l && typeof l.relation === "string" ? l.relation : null;
      const hasFrontend =
        "hasFrontend" in l && typeof l.hasFrontend === "boolean" ? l.hasFrontend : true;
      return { group, relation, hasFrontend };
    }
    return { group: [], relation: null, hasFrontend: true };
  });

  const skipped =
    "skipped" in parsed && Array.isArray(parsed.skipped) ? toKeyReasonArray(parsed.skipped) : [];
  const excluded =
    "excluded" in parsed && Array.isArray(parsed.excluded) ? toKeyReasonArray(parsed.excluded) : [];

  return { layers, skipped, excluded };
}

/**
 * Build a single-layer fallback when prioritization fails or is skipped.
 */
export function fallbackResult(tickets: string[]): PrioritizeResult {
  return {
    layers: [{ group: tickets, relation: null, hasFrontend: true }],
    skipped: [],
    excluded: [],
  };
}

/**
 * Classify sprint tickets into pending (To Do/Backlog) and context (everything else).
 */
export function classifyTickets(tickets: SprintTicket[]): {
  pending: SprintTicket[];
  context: SprintTicket[];
} {
  const pendingStatuses = new Set(["to do", "backlog"]);
  const pending = tickets.filter((t) => pendingStatuses.has(t.status.toLowerCase()));
  const context = tickets.filter((t) => !pendingStatuses.has(t.status.toLowerCase()));
  return { pending, context };
}

/**
 * Filter a prioritizer layer's group to only unprocessed pending tickets,
 * excluding skipped and excluded tickets.
 */
export function filterGroup(
  group: string[],
  unprocessed: Set<string>,
  skippedKeys: Set<string>,
  excludedKeys: Set<string>,
): string[] {
  return group.filter((t) => unprocessed.has(t) && !skippedKeys.has(t) && !excludedKeys.has(t));
}

// ─── Prioritize via Claude ──────────────────────────────────────────────────

export async function prioritizeTickets(
  allTickets: string[],
  runner: ClaudeRunner,
  scriptDir: string,
  log: LogFn,
): Promise<PrioritizeResult> {
  if (allTickets.length <= 1) return fallbackResult(allTickets);

  log(`PRIORITIZING: ${allTickets.length} ticket(s)`);

  const ticketList = allTickets.join(",");
  const { code, stdout } = await runner.run(
    [
      `[GSD: prioritize ${allTickets.length} tickets] ${AUTONOMY_PREFIX}`,
      "",
      `Invoke Skill("/jira-ticket-prioritizer ${ticketList}").`,
      "",
      "Return json ONLY without code fence",
    ].join("\n"),
    {
      taskName: `get-shit-done: prioritizing ${allTickets.length} tickets`,
      cwd: scriptDir,
      timeoutMs: 5 * 60 * 60 * 1000,
      model: "opus",
    },
  );

  if (code === 0) {
    try {
      const result = parsePrioritizerOutput(stdout);
      if (result) {
        logPrioritizeResult(result, log);
        return result;
      }
    } catch (err) {
      log(`WARN: Prioritizer parse failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    log(`WARN: Prioritizer exited with code ${code}`);
  }

  log(`WARN: Falling back to unprioritized order`);
  return fallbackResult(allTickets);
}

function logPrioritizeResult(result: PrioritizeResult, log: LogFn): void {
  const summary = result.layers.map((l, i) => `L${i}:[${l.group.join(",")}]`).join(" ");
  log(`PRIORITIZED: ${result.layers.length} layer(s) — ${summary}`);
  if (result.skipped.length > 0) log(`SKIPPED: ${result.skipped.map((s) => s.key).join(", ")}`);
  if (result.excluded.length > 0) log(`EXCLUDED: ${result.excluded.map((e) => e.key).join(", ")}`);
}
