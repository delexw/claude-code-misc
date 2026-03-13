/**
 * Pure logic functions for prioritizer output parsing and layer filtering.
 * Extracted from get-shit-done.ts for testability.
 */

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

/**
 * Parse raw prioritizer JSON output into a typed PrioritizeResult.
 * Handles both new grouped format and legacy array-of-arrays format.
 * Returns null if parsing fails.
 */
export function parsePrioritizerOutput(raw: string): PrioritizeResult | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.layers) || parsed.layers.length === 0) return null;

  const layers: GroupedLayer[] = parsed.layers.map((l: GroupedLayer | string[]) => {
    if (Array.isArray(l)) return { group: l, relation: null, hasFrontend: true };
    return { group: l.group, relation: l.relation ?? null, hasFrontend: l.hasFrontend ?? true };
  });

  const skipped = Array.isArray(parsed.skipped) ? parsed.skipped : [];
  const excluded = Array.isArray(parsed.excluded) ? parsed.excluded : [];

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
  return group.filter((t) =>
    unprocessed.has(t) && !skippedKeys.has(t) && !excludedKeys.has(t),
  );
}
