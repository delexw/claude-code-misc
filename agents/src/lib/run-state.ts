/**
 * Persists prioritizer result and per-group state across runs so that
 * a restart resumes from where it left off instead of re-prioritizing.
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
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

  /** Save prioritizer raw output, preserving existing group states if present. */
  save(rawJson: string): void {
    const existing = this.load();
    const state: SerializedState = {
      prioritizerRaw: JSON.parse(rawJson) as RawPrioritizeOutput,
      groupStates: existing ? serializeGroupStates(existing.groupStates) : {},
    };
    writeFileSync(this.filePath, JSON.stringify(state, null, 2));
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
   * Extract ticket keys that belong to completed groups (groups with PR URLs)
   * plus any extra keys marked via markCompleted().
   */
  completedTicketKeys(): Set<string> {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      const completed = new Set<string>(raw.extraCompleted ?? []);
      if (!raw.prioritizerRaw?.layers || !raw.groupStates) return completed;
      for (const layer of raw.prioritizerRaw.layers) {
        const primaryKey = layer.group[0]?.key;
        if (!primaryKey) continue;
        const groupState = raw.groupStates[primaryKey];
        if (groupState && Object.keys(groupState.prUrls).length > 0) {
          for (const ticket of layer.group) {
            completed.add(ticket.key);
          }
        }
      }
      return completed;
    } catch {
      return new Set();
    }
  }

  /** Mark a ticket key as completed (for tickets outside group processing). */
  markCompleted(key: string): void {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
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
