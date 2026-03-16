/**
 * Persists prioritizer result and per-group state across runs so that
 * a restart resumes from where it left off instead of re-prioritizing.
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import type { PrioritizeResult } from "./prioritizer.js";
import type { GroupStates, LayerState, RepoMap } from "./pipeline.js";

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
  prioritizerResult: PrioritizeResult;
  /** Per-group state keyed by primary ticket key. */
  groupStates: { [group: GroupKey]: SerializedLayerState };
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
  load(): { prioritizerResult: PrioritizeResult; groupStates: GroupStates } | null {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      if (!raw.prioritizerResult?.layers || !raw.groupStates) return null;
      return {
        prioritizerResult: raw.prioritizerResult,
        groupStates: deserializeGroupStates(raw.groupStates),
      };
    } catch {
      return null;
    }
  }

  /** Save prioritizer result, preserving existing group states if present. */
  save(result: PrioritizeResult): void {
    const existing = this.load();
    const state: SerializedState = {
      prioritizerResult: result,
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

  /** Clear saved state (call on clean completion). */
  clear(): void {
    try {
      unlinkSync(this.filePath);
    } catch {
      // Already gone
    }
  }
}
