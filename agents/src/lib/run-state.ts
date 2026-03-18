/**
 * Persists prioritizer result and per-group state across runs so that
 * a restart resumes from where it left off instead of re-prioritizing.
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { GroupStates, RepoMap } from "./dag.js";
import type { RawPrioritizeOutput } from "./prioritizer.js";

/** Repo root absolute path (e.g. "/Users/x/Envato/seo/elements-storefront"). */
type RepoPath = string;

/** Primary ticket key used as group identifier (e.g. "EC-10819"). */
type GroupKey = string;

/** Serialized layer state as written to disk (Maps become plain objects). */
interface SerializedLayerState {
  /** repo path → merge branch name (e.g. "EC-10819-merge-add-team-tabs") */
  branches: { [repo: RepoPath]: string };
  /** repo path → pull request URL (e.g. "https://github.com/org/repo/pull/42") */
  prUrls: { [repo: RepoPath]: string };
}

interface SerializedState {
  /** Active sprint name when this state was saved. */
  sprint?: string;
  /** Raw LLM output from prioritizer (original field names: repo, depends_on). */
  prioritizerRaw: RawPrioritizeOutput;
  /** Per-group state keyed by primary ticket key. */
  groupStates: { [group: GroupKey]: SerializedLayerState };
  /** Ticket keys marked as completed outside of group processing (e.g. excluded parents). */
  extraCompleted?: string[];
}

function serializeMap(m: RepoMap): { [repo: RepoPath]: string } {
  return Object.fromEntries(m);
}

function deserializeMap(o: { [repo: RepoPath]: string }): RepoMap {
  return new Map(Object.entries(o));
}

function serializeGroupStates(gs: GroupStates): { [group: GroupKey]: SerializedLayerState } {
  const out: { [group: GroupKey]: SerializedLayerState } = {};
  for (const [key, state] of gs) {
    out[key] = { branches: serializeMap(state.branches), prUrls: serializeMap(state.prUrls) };
  }
  return out;
}

function deserializeGroupStates(raw: { [group: GroupKey]: SerializedLayerState }): GroupStates {
  const gs: GroupStates = new Map();
  for (const [key, state] of Object.entries(raw)) {
    gs.set(key, { branches: deserializeMap(state.branches), prUrls: deserializeMap(state.prUrls) });
  }
  return gs;
}

export class RunState {
  constructor(private filePath: string) {}

  /** Load saved state. Returns null if no state exists or it's corrupt. */
  load(): { prioritizerRawJson: string; groupStates: GroupStates } | null {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      if (!raw.prioritizerRaw || !raw.groupStates) return null;
      return {
        prioritizerRawJson: JSON.stringify(raw.prioritizerRaw),
        groupStates: deserializeGroupStates(raw.groupStates),
      };
    } catch {
      return null;
    }
  }

  /**
   * Prune merged repos from group state entries.
   *
   * For each repo within a group, if its PR is merged, that repo is removed
   * from both `prUrls` and `branches` — so downstream dependents no longer
   * inherit it as a base branch (it's already in main).
   *
   * A group is removed entirely once all its repos are pruned.
   * Returns the keys of fully-pruned groups.
   *
   * @param checkMerged - override for testing; defaults to `gh pr view` check
   */
  pruneMergedGroups(checkMerged?: (url: string) => boolean): string[] {
    const isMerged =
      checkMerged ??
      ((url: string) => {
        try {
          const state = execFileSync(
            "gh",
            ["pr", "view", url, "--json", "state", "--jq", ".state"],
            { encoding: "utf-8" },
          ).trim();
          return state === "MERGED";
        } catch {
          return false;
        }
      });

    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      const fullyPruned: string[] = [];
      let changed = false;

      for (const [key, state] of Object.entries(raw.groupStates ?? {})) {
        for (const [repo, prUrl] of Object.entries(state.prUrls)) {
          if (isMerged(prUrl)) {
            delete state.prUrls[repo];
            delete state.branches[repo];
            changed = true;
          }
        }

        const remaining = Object.keys(state.prUrls).length + Object.keys(state.branches).length;
        if (remaining === 0) {
          delete raw.groupStates[key];
          fullyPruned.push(key);
        }
      }

      if (!changed) return [];

      if (raw.extraCompleted) {
        raw.extraCompleted = raw.extraCompleted.filter((k) => !fullyPruned.includes(k));
      }

      const remainingGroups = Object.keys(raw.groupStates).length;
      const remainingExtra = (raw.extraCompleted ?? []).length;

      if (remainingGroups === 0 && remainingExtra === 0) {
        this.clear();
      } else {
        writeFileSync(this.filePath, JSON.stringify(raw, null, 2));
      }

      return fullyPruned;
    } catch {
      return [];
    }
  }

  /** Save prioritizer raw output, preserving existing group states, sprint, and extraCompleted. */
  save(rawJson: string, sprint?: string): void {
    const existing = this.load();
    const existingExtra = this.loadExtraCompleted();
    const state: SerializedState = {
      sprint: sprint ?? this.loadSprint(),
      prioritizerRaw: JSON.parse(rawJson) as RawPrioritizeOutput,
      groupStates: existing ? serializeGroupStates(existing.groupStates) : {},
      ...(existingExtra.length > 0 && { extraCompleted: existingExtra }),
    };
    writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  private loadExtraCompleted(): string[] {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      return raw.extraCompleted ?? [];
    } catch {
      return [];
    }
  }

  private loadSprint(): string | undefined {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      return raw.sprint;
    } catch {
      return undefined;
    }
  }

  /** Update the per-group states (call after each successful group). */
  updateGroupStates(groupStates: GroupStates): void {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      raw.groupStates = serializeGroupStates(groupStates);
      writeFileSync(this.filePath, JSON.stringify(raw, null, 2));
    } catch {
      // If the file doesn't exist, nothing to update
    }
  }

  /** Extract all ticket keys from the saved prioritizer layers. */
  previousTicketKeys(): Set<string> {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      if (!raw.prioritizerRaw?.layers) return new Set();
      const keys = new Set<string>();
      for (const layer of raw.prioritizerRaw.layers) {
        for (const ticket of layer.group) {
          keys.add(ticket.key);
        }
      }
      return keys;
    } catch {
      return new Set();
    }
  }

  /**
   * Extract ticket keys that are completed — either stored in groupStates
   * with PR URLs, or marked via markCompleted().
   */
  completedTicketKeys(): Set<string> {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      const completed = new Set<string>(raw.extraCompleted ?? []);
      if (raw.groupStates) {
        for (const [key, state] of Object.entries(raw.groupStates)) {
          if (Object.keys(state.prUrls).length > 0) {
            completed.add(key);
          }
        }
      }
      return completed;
    } catch {
      return new Set();
    }
  }

  /**
   * Remove extraCompleted entries whose tickets are no longer pending in the sprint.
   * Called during discovery once we know which tickets are still "To Do"/"Backlog".
   */
  pruneExtraCompleted(pendingKeys: Set<string>): void {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      if (!raw.extraCompleted?.length) return;
      const pruned = raw.extraCompleted.filter((k) => pendingKeys.has(k));
      if (pruned.length === raw.extraCompleted.length) return;
      raw.extraCompleted = pruned.length > 0 ? pruned : undefined;
      writeFileSync(this.filePath, JSON.stringify(raw, null, 2));
    } catch {
      // No state file — nothing to prune
    }
  }

  /** Mark a ticket key as completed (skips keys already in groupStates with PRs). */
  markCompleted(key: string): void {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      const gs = raw.groupStates?.[key];
      if (gs && Object.keys(gs.prUrls).length > 0) return;
      const extra = new Set(raw.extraCompleted ?? []);
      extra.add(key);
      raw.extraCompleted = [...extra];
      writeFileSync(this.filePath, JSON.stringify(raw, null, 2));
    } catch {
      // If the file doesn't exist, nothing to update
    }
  }

  /** Clear saved state entirely. */
  clear(): void {
    try {
      unlinkSync(this.filePath);
    } catch {
      // Already gone
    }
  }
}
