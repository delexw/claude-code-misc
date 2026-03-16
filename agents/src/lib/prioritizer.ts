/**
 * Prioritizer: parsing, filtering, and ticket prioritization via Claude.
 */

import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import { parseJson } from "./json.js";
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

export interface Verification {
  required: boolean;
  reason: string;
}

export interface GroupedLayer {
  group: TicketAssignment[];
  relation: string | null;
  verification: Verification;
  /** Primary ticket key of the parent group this depends on, or null for root (branches from main). */
  dependsOn: string | null;
}

/** Return the primary ticket key (first ticket) of a group. */
export function primaryKey(layer: GroupedLayer): string {
  return layer.group[0]?.key ?? "";
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

// ─── Raw JSON shape matching the skill output-format.md ─────────────────────

interface RawRepo {
  repo: string;
  branch: string;
}
interface RawTicket {
  key: string;
  repos: RawRepo[];
}
interface RawVerification {
  required: boolean;
  reason: string;
}
interface RawLayer {
  group: RawTicket[];
  relation: string | null;
  verification: RawVerification;
  depends_on: string | null;
}
interface RawKeyReason {
  key: string;
  reason: string;
}
interface RawPrioritizeOutput {
  layers: RawLayer[];
  skipped?: RawKeyReason[];
  excluded?: RawKeyReason[];
}

function isRawOutput(v: unknown): v is RawPrioritizeOutput {
  return (
    typeof v === "object" &&
    v !== null &&
    "layers" in v &&
    Array.isArray(v.layers) &&
    v.layers.length > 0
  );
}

function toGroupedLayer(raw: RawLayer): GroupedLayer {
  return {
    group: raw.group.map((t) => ({
      key: t.key,
      repos: (t.repos ?? []).map((r) => ({ repoPath: r.repo, branch: r.branch })),
    })),
    relation: raw.relation ?? null,
    verification: {
      required: raw.verification?.required ?? true,
      reason: raw.verification?.reason ?? "unknown",
    },
    dependsOn: raw.depends_on ?? null,
  };
}

/**
 * Parse raw prioritizer JSON output into a typed PrioritizeResult.
 * Expects the format defined in output-format.md. Returns null if parsing fails.
 */
export function parsePrioritizerOutput(raw: string): PrioritizeResult | null {
  const parsed = parseJson(raw, isRawOutput);
  if (!parsed) return null;

  const layers = parsed.layers.map(toGroupedLayer);
  const skipped = parsed.skipped ?? [];
  const excluded = parsed.excluded ?? [];

  return { layers, skipped, excluded };
}

/**
 * Validate that dependsOn references only earlier groups and has no forward/self references.
 * Returns an array of warning messages (empty = valid).
 */
export function validateDependsOn(layers: GroupedLayer[]): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const layer of layers) {
    const pk = primaryKey(layer);
    // Build set of all ticket keys in this group for lookup
    const groupKeys = new Set(layer.group.map((t) => t.key));

    if (layer.dependsOn !== null) {
      // Check if dependsOn references a group we haven't seen yet
      const depKey = layer.dependsOn;
      if (groupKeys.has(depKey)) {
        warnings.push(`Group ${pk}: depends_on "${depKey}" references itself`);
      } else if (!seen.has(depKey)) {
        // Check if it's a ticket in any group we've seen (ticketToGroup resolution)
        // For simplicity, just check if any earlier group contains this key
        warnings.push(`Group ${pk}: depends_on "${depKey}" references a group not yet seen — possible forward reference or missing group`);
      }
    }

    // Add all tickets from this group to seen set
    for (const t of layer.group) {
      seen.add(t.key);
    }
  }

  return warnings;
}

/**
 * Build a single-layer fallback when there is only one ticket (prioritization skipped).
 */
export function fallbackResult(tickets: string[]): PrioritizeResult {
  return {
    layers: [
      {
        group: tickets.map((key) => ({ key, repos: [] })),
        relation: null,
        verification: { required: true, reason: "fallback — assuming verification needed" },
        dependsOn: null,
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
  previousResult?: PrioritizeResult,
): Promise<PrioritizeResult> {
  if (allTickets.length <= 1) return fallbackResult(allTickets);

  log(`PRIORITIZING: ${allTickets.length} ticket(s)${previousResult ? " (guided by previous run)" : ""}`);

  const ticketList = allTickets.join(",");
  const repoList = repos.join("\n");

  const guidanceNote = previousResult
    ? [
        "",
        "IMPORTANT — PREVIOUS RUN GUIDANCE:",
        "A previous prioritization run produced the result below. You MUST preserve:",
        "- The first ticket in each group (primary key) — downstream depends_on references it",
        "- Layer order, repo assignments, and branch names for existing tickets",
        "- depends_on values for existing groups",
        "Tickets already forged should be treated as COMPLETED for dependency resolution,",
        "regardless of their current JIRA status. Slot any new tickets into the appropriate",
        "layer (never as the first ticket in an existing group). Remove any tickets no longer in the list above.",
        "",
        "Previous result:",
        "<previous_result>",
        JSON.stringify(previousResult),
        "</previous_result>"
      ].join("\n")
    : "";

  const { code, stdout } = await runner.run(
    [
      `[GSD: prioritize ${allTickets.length} tickets] ${AUTONOMY_PREFIX}`,
      guidanceNote,
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
    const result = parsePrioritizerOutput(stdout);
    if (result) {
      resolveAndValidateRepos(result, repos);
      for (const w of validateDependsOn(result.layers)) log(`WARN: ${w}`);
      logPrioritizeResult(result, log);
      return result;
    }
    throw new Error("Prioritizer output parse failed — terminating");
  } else {
    throw new Error(`Prioritizer exited with code ${code} — terminating`);
  }
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
  const summary = result.layers.map((l, i) => {
    const dep = l.dependsOn ? `→${l.dependsOn}` : "";
    return `L${i}:[${ticketKeys(l.group).join(",")}]${dep}`;
  }).join(" ");
  log(`PRIORITIZED: ${result.layers.length} layer(s) — ${summary}`);
  if (result.skipped.length > 0) log(`SKIPPED: ${result.skipped.map((s) => s.key).join(", ")}`);
  if (result.excluded.length > 0) log(`EXCLUDED: ${result.excluded.map((e) => e.key).join(", ")}`);
}
