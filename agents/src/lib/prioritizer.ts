/**
 * Prioritizer: parsing, filtering, and ticket prioritization via Claude.
 */

import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import { AUTONOMY_PREFIX } from "./prompts.js";
import { resolveRepoName } from "./repos.js";

export interface RepoAssignment {
  repoPath: string; // repo basename from prioritizer, resolved to abs path by pipeline
  branch: string; // slugified branch name (e.g. "ec-123-fix-payment-bug")
}

export interface TicketAssignment {
  key: string;
  repos: RepoAssignment[]; // one or more repos this ticket touches
}

export function ticketKeys(group: TicketAssignment[]): string[] {
  return group.map((t) => t.key);
}

export interface GroupedLayer {
  group: TicketAssignment[];
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

function isRepoObj(r: unknown): r is { repo: string; branch: string } {
  return (
    typeof r === "object" &&
    r !== null &&
    "repo" in r &&
    typeof r.repo === "string" &&
    "branch" in r &&
    typeof r.branch === "string"
  );
}

function toRepoAssignments(raw: unknown): RepoAssignment[] {
  if (Array.isArray(raw)) {
    return raw.filter(isRepoObj).map((r) => ({ repoPath: r.repo, branch: r.branch }));
  }
  if (isRepoObj(raw)) {
    return [{ repoPath: raw.repo, branch: raw.branch }];
  }
  return [];
}

/** Parse mixed array of strings or {key, repos} objects into TicketAssignment[] */
function toTicketAssignments(arr: unknown[]): TicketAssignment[] {
  return arr
    .map((item) => {
      if (typeof item === "string") return { key: item, repos: [] };
      if (
        typeof item === "object" &&
        item !== null &&
        "key" in item &&
        typeof item.key === "string"
      ) {
        // New format: { key, repos: [{ repo, branch }] }
        if ("repos" in item) {
          return { key: item.key, repos: toRepoAssignments(item.repos) };
        }
        // Compat: { key, repo, branch } → single-element repos array
        if (
          "repo" in item &&
          typeof item.repo === "string" &&
          "branch" in item &&
          typeof item.branch === "string"
        ) {
          return { key: item.key, repos: [{ repoPath: item.repo, branch: item.branch }] };
        }
        return { key: item.key, repos: [] };
      }
      return null;
    })
    .filter((x): x is TicketAssignment => x !== null);
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
        group: toTicketAssignments(l),
        relation: null,
        hasFrontend: true,
      };
    }
    if (typeof l === "object" && l !== null) {
      const group = "group" in l && Array.isArray(l.group) ? toTicketAssignments(l.group) : [];
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
    layers: [
      {
        group: tickets.map((key) => ({ key, repos: [] })),
        relation: null,
        hasFrontend: true,
      },
    ],
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
  group: TicketAssignment[],
  unprocessed: Set<string>,
  skippedKeys: Set<string>,
  excludedKeys: Set<string>,
): TicketAssignment[] {
  return group.filter(
    (t) => unprocessed.has(t.key) && !skippedKeys.has(t.key) && !excludedKeys.has(t.key),
  );
}

// ─── Prioritize via Claude ──────────────────────────────────────────────────

export async function prioritizeTickets(
  allTickets: string[],
  repos: string[],
  runner: ClaudeRunner,
  scriptDir: string,
  log: LogFn,
): Promise<PrioritizeResult> {
  if (allTickets.length <= 1) return fallbackResult(allTickets);

  log(`PRIORITIZING: ${allTickets.length} ticket(s)`);

  const ticketList = allTickets.join(",");
  const repoList = repos.join("\n");
  const { code, stdout } = await runner.run(
    [
      `[GSD: prioritize ${allTickets.length} tickets] ${AUTONOMY_PREFIX}`,
      "",
      `Invoke Skill("/jira-ticket-prioritizer 'Prioritize tickets ${ticketList} and assign each to one of these repos:`,
      repoList,
      `Use the repo basename in output (not the full path).'").`,
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
        resolveAndValidateRepos(result, repos);
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

/**
 * Validate and resolve repo basenames to absolute paths.
 * Throws if any ticket is missing repos or has unresolvable repo names.
 */
function resolveAndValidateRepos(result: PrioritizeResult, baseRepos: string[]): void {
  for (const layer of result.layers) {
    for (const ticket of layer.group) {
      if (ticket.repos.length === 0) {
        throw new Error(`Prioritizer did not assign any repos for ${ticket.key}`);
      }
      for (const ra of ticket.repos) {
        if (!ra.repoPath) throw new Error(`Empty repo name for ${ticket.key}`);
        if (!ra.branch) throw new Error(`Empty branch name for ${ticket.key} in ${ra.repoPath}`);
        const resolved = resolveRepoName(ra.repoPath, baseRepos);
        if (!resolved) throw new Error(`Cannot resolve repo "${ra.repoPath}" for ${ticket.key}`);
        ra.repoPath = resolved;
      }
    }
  }
}

function logPrioritizeResult(result: PrioritizeResult, log: LogFn): void {
  const summary = result.layers.map((l, i) => `L${i}:[${ticketKeys(l.group).join(",")}]`).join(" ");
  log(`PRIORITIZED: ${result.layers.length} layer(s) — ${summary}`);
  if (result.skipped.length > 0) log(`SKIPPED: ${result.skipped.map((s) => s.key).join(", ")}`);
  if (result.excluded.length > 0) log(`EXCLUDED: ${result.excluded.map((e) => e.key).join(", ")}`);
}
