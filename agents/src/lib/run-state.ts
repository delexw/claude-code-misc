/**
 * Persists prioritizer result and layer state across runs so that
 * a restart resumes from where it left off instead of re-prioritizing.
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import type { PrioritizeResult } from "./prioritizer.js";
import type { LayerState, RepoMap } from "./pipeline.js";

interface SerializedState {
  /** Sorted ticket keys the state was built for — used to detect staleness. */
  ticketFingerprint: string;
  prioritizerResult: PrioritizeResult;
  layerState: {
    branches: Record<string, string>;
    prUrls: Record<string, string>;
  };
}

function fingerprint(ticketKeys: string[]): string {
  return [...ticketKeys].sort().join(",");
}

function serializeMap(m: RepoMap): Record<string, string> {
  return Object.fromEntries(m);
}

function deserializeMap(o: Record<string, string>): RepoMap {
  return new Map(Object.entries(o));
}

export class RunState {
  constructor(private filePath: string) {}

  /**
   * Load saved state if it matches the current ticket set.
   * Returns null if no state exists, it's corrupt, or the tickets have changed.
   */
  load(currentTicketKeys: string[]): { prioritizerResult: PrioritizeResult; layerState: LayerState } | null {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      if (!raw.prioritizerResult?.layers || !raw.layerState) return null;
      if (raw.ticketFingerprint !== fingerprint(currentTicketKeys)) return null;
      return {
        prioritizerResult: raw.prioritizerResult,
        layerState: {
          branches: deserializeMap(raw.layerState.branches),
          prUrls: deserializeMap(raw.layerState.prUrls),
        },
      };
    } catch {
      return null;
    }
  }

  /** Save prioritizer result with initial empty layer state. */
  savePrioritizerResult(result: PrioritizeResult, ticketKeys: string[]): void {
    const state: SerializedState = {
      ticketFingerprint: fingerprint(ticketKeys),
      prioritizerResult: result,
      layerState: { branches: {}, prUrls: {} },
    };
    writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  /** Update the layer state (call after each successful layer). */
  updateLayerState(layerState: LayerState): void {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf-8")) as SerializedState;
      raw.layerState = {
        branches: serializeMap(layerState.branches),
        prUrls: serializeMap(layerState.prUrls),
      };
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
