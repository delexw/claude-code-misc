import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, unlinkSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RunState } from "./run-state.js";
import type { PrioritizeResult } from "./prioritizer.js";

function makePrioritizerResult(keys: string[]): PrioritizeResult {
  return {
    layers: [
      {
        group: keys.map((key) => ({
          key,
          repos: [{ repoPath: `/repo/${key}`, branch: `${key}-branch` }],
        })),
        relation: null,
        verification: { required: true, reason: "test" },
      },
    ],
    skipped: [],
    excluded: [],
  };
}

function makeMultiLayerResult(): PrioritizeResult {
  return {
    layers: [
      {
        group: [{ key: "EC-1", repos: [{ repoPath: "/repo/a", branch: "ec-1-fix" }] }],
        relation: null,
        verification: { required: false, reason: "api only" },
      },
      {
        group: [{ key: "EC-2", repos: [{ repoPath: "/repo/a", branch: "ec-2-ui" }] }],
        relation: "depends-on",
        verification: { required: true, reason: "ui change" },
      },
    ],
    skipped: [{ key: "EC-3", reason: "blocked" }],
    excluded: [{ key: "EC-4", reason: "Done" }],
  };
}

void describe("RunState", () => {
  let tmpDir: string;
  let stateFile: string;
  let state: RunState;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "run-state-test-"));
    stateFile = join(tmpDir, "run-state.json");
    state = new RunState(stateFile);
  });

  afterEach(() => {
    try {
      unlinkSync(stateFile);
    } catch {}
  });

  // ─── load ───────────────────────────────────────────────────────────────────

  void it("returns null when no state file exists", () => {
    assert.equal(state.load(["EC-1"]), null);
  });

  void it("returns null for corrupt JSON", () => {
    writeFileSync(stateFile, "not json");
    assert.equal(state.load(["EC-1"]), null);
  });

  void it("returns null when ticketFingerprint does not match", () => {
    const result = makePrioritizerResult(["EC-1", "EC-2"]);
    state.savePrioritizerResult(result, ["EC-1", "EC-2"]);

    // Different tickets → stale
    assert.equal(state.load(["EC-1", "EC-3"]), null);
  });

  void it("returns null when saved state has missing fields", () => {
    writeFileSync(stateFile, JSON.stringify({ ticketFingerprint: "EC-1", layerState: null }));
    assert.equal(state.load(["EC-1"]), null);
  });

  // ─── savePrioritizerResult + load round-trip ────────────────────────────────

  void it("saves and loads prioritizer result with matching tickets", () => {
    const result = makePrioritizerResult(["EC-1", "EC-2"]);
    state.savePrioritizerResult(result, ["EC-1", "EC-2"]);

    const loaded = state.load(["EC-1", "EC-2"]);
    assert.ok(loaded);
    assert.equal(loaded.prioritizerResult.layers.length, 1);
    assert.equal(loaded.prioritizerResult.layers[0].group[0].key, "EC-1");
    assert.equal(loaded.prioritizerResult.layers[0].group[1].key, "EC-2");
  });

  void it("fingerprint is order-independent", () => {
    const result = makePrioritizerResult(["EC-2", "EC-1"]);
    state.savePrioritizerResult(result, ["EC-2", "EC-1"]);

    // Load with reversed order → same fingerprint
    const loaded = state.load(["EC-1", "EC-2"]);
    assert.ok(loaded);
  });

  void it("preserves skipped and excluded in round-trip", () => {
    const result = makeMultiLayerResult();
    state.savePrioritizerResult(result, ["EC-1", "EC-2", "EC-3", "EC-4"]);

    const loaded = state.load(["EC-1", "EC-2", "EC-3", "EC-4"]);
    assert.ok(loaded);
    assert.equal(loaded.prioritizerResult.skipped.length, 1);
    assert.equal(loaded.prioritizerResult.skipped[0].key, "EC-3");
    assert.equal(loaded.prioritizerResult.excluded.length, 1);
    assert.equal(loaded.prioritizerResult.excluded[0].key, "EC-4");
  });

  void it("preserves multi-layer structure with relations and verification", () => {
    const result = makeMultiLayerResult();
    state.savePrioritizerResult(result, ["EC-1", "EC-2", "EC-3", "EC-4"]);

    const loaded = state.load(["EC-1", "EC-2", "EC-3", "EC-4"]);
    assert.ok(loaded);
    assert.equal(loaded.prioritizerResult.layers.length, 2);
    assert.equal(loaded.prioritizerResult.layers[0].verification.required, false);
    assert.equal(loaded.prioritizerResult.layers[1].relation, "depends-on");
    assert.equal(loaded.prioritizerResult.layers[1].verification.required, true);
  });

  void it("initial layerState has empty branches and prUrls", () => {
    const result = makePrioritizerResult(["EC-1"]);
    state.savePrioritizerResult(result, ["EC-1"]);

    const loaded = state.load(["EC-1"]);
    assert.ok(loaded);
    assert.equal(loaded.layerState.branches.size, 0);
    assert.equal(loaded.layerState.prUrls.size, 0);
  });

  // ─── updateLayerState ───────────────────────────────────────────────────────

  void it("updates layer state and preserves prioritizer result", () => {
    const result = makePrioritizerResult(["EC-1", "EC-2"]);
    state.savePrioritizerResult(result, ["EC-1", "EC-2"]);

    state.updateLayerState({
      branches: new Map([["/repo/a", "ec-1-merge-branch"]]),
      prUrls: new Map([["/repo/a", "https://github.com/org/repo/pull/42"]]),
    });

    const loaded = state.load(["EC-1", "EC-2"]);
    assert.ok(loaded);
    assert.equal(loaded.layerState.branches.get("/repo/a"), "ec-1-merge-branch");
    assert.equal(loaded.layerState.prUrls.get("/repo/a"), "https://github.com/org/repo/pull/42");
    // prioritizer result untouched
    assert.equal(loaded.prioritizerResult.layers[0].group[0].key, "EC-1");
  });

  void it("overwrites layer state on subsequent updates", () => {
    const result = makePrioritizerResult(["EC-1"]);
    state.savePrioritizerResult(result, ["EC-1"]);

    state.updateLayerState({
      branches: new Map([["/repo/a", "layer-0-branch"]]),
      prUrls: new Map([["/repo/a", "https://pr/1"]]),
    });

    state.updateLayerState({
      branches: new Map([
        ["/repo/a", "layer-0-branch"],
        ["/repo/b", "layer-1-branch"],
      ]),
      prUrls: new Map([
        ["/repo/a", "https://pr/1"],
        ["/repo/b", "https://pr/2"],
      ]),
    });

    const loaded = state.load(["EC-1"]);
    assert.ok(loaded);
    assert.equal(loaded.layerState.branches.size, 2);
    assert.equal(loaded.layerState.branches.get("/repo/b"), "layer-1-branch");
    assert.equal(loaded.layerState.prUrls.get("/repo/b"), "https://pr/2");
  });

  void it("updateLayerState is a no-op when no state file exists", () => {
    // Should not throw
    state.updateLayerState({
      branches: new Map([["/repo/a", "branch"]]),
      prUrls: new Map(),
    });
    assert.equal(existsSync(stateFile), false);
  });

  // ─── clear ──────────────────────────────────────────────────────────────────

  void it("clear removes the state file", () => {
    const result = makePrioritizerResult(["EC-1"]);
    state.savePrioritizerResult(result, ["EC-1"]);
    assert.equal(existsSync(stateFile), true);

    state.clear();
    assert.equal(existsSync(stateFile), false);
  });

  void it("clear is safe when no file exists", () => {
    state.clear(); // should not throw
  });

  void it("load returns null after clear", () => {
    const result = makePrioritizerResult(["EC-1"]);
    state.savePrioritizerResult(result, ["EC-1"]);
    state.clear();
    assert.equal(state.load(["EC-1"]), null);
  });

  // ─── staleness / fingerprint edge cases ─────────────────────────────────────

  void it("detects stale state when a ticket is added", () => {
    const result = makePrioritizerResult(["EC-1", "EC-2"]);
    state.savePrioritizerResult(result, ["EC-1", "EC-2"]);

    // Sprint now has an extra ticket
    assert.equal(state.load(["EC-1", "EC-2", "EC-3"]), null);
  });

  void it("detects stale state when a ticket is removed", () => {
    const result = makePrioritizerResult(["EC-1", "EC-2"]);
    state.savePrioritizerResult(result, ["EC-1", "EC-2"]);

    // Sprint lost a ticket
    assert.equal(state.load(["EC-1"]), null);
  });

  void it("matches when tickets are identical but in different order", () => {
    const result = makePrioritizerResult(["EC-3", "EC-1", "EC-2"]);
    state.savePrioritizerResult(result, ["EC-3", "EC-1", "EC-2"]);

    const loaded = state.load(["EC-2", "EC-3", "EC-1"]);
    assert.ok(loaded);
  });

  // ─── resume scenario (the real use case) ────────────────────────────────────

  void it("full resume scenario: save → update layers → load on restart", () => {
    const tickets = ["EC-10819", "EC-10820", "EC-10821", "EC-10822", "EC-10823", "EC-10824", "EC-10798"];
    const result: PrioritizeResult = {
      layers: [
        {
          group: [
            { key: "EC-10819", repos: [{ repoPath: "/repo/storefront", branch: "ec-10819-tabs" }] },
            { key: "EC-10820", repos: [{ repoPath: "/repo/storefront", branch: "ec-10820-display" }] },
          ],
          relation: "same-epic",
          verification: { required: true, reason: "ui" },
        },
        {
          group: [
            { key: "EC-10821", repos: [{ repoPath: "/repo/storefront", branch: "ec-10821-state" }] },
          ],
          relation: null,
          verification: { required: true, reason: "state management" },
        },
        {
          group: [
            { key: "EC-10822", repos: [
              { repoPath: "/repo/storefront", branch: "ec-10822-fetch" },
              { repoPath: "/repo/backend", branch: "ec-10822-fetch" },
            ]},
          ],
          relation: null,
          verification: { required: true, reason: "data fetching" },
        },
        {
          group: [
            { key: "EC-10823", repos: [{ repoPath: "/repo/storefront", branch: "ec-10823-filters" }] },
            { key: "EC-10824", repos: [{ repoPath: "/repo/storefront", branch: "ec-10824-empty" }] },
          ],
          relation: "same-epic",
          verification: { required: true, reason: "ui" },
        },
      ],
      skipped: [],
      excluded: [{ key: "EC-10798", reason: "parent story" }],
    };

    // Step 1: Initial save
    state.savePrioritizerResult(result, tickets);

    // Step 2: Layers 0-2 complete, updating state after each
    state.updateLayerState({
      branches: new Map([["/repo/storefront", "EC-10819-merge-add-team-tabs"]]),
      prUrls: new Map([["/repo/storefront", "https://github.com/org/repo/pull/100"]]),
    });

    state.updateLayerState({
      branches: new Map([["/repo/storefront", "EC-10821-merge-add-tab-state"]]),
      prUrls: new Map([["/repo/storefront", "https://github.com/org/repo/pull/101"]]),
    });

    state.updateLayerState({
      branches: new Map([
        ["/repo/storefront", "EC-10822-merge-update-data-fetching"],
        ["/repo/backend", "EC-10822-merge-update-data-fetching"],
      ]),
      prUrls: new Map([
        ["/repo/storefront", "https://github.com/org/repo/pull/102"],
        ["/repo/backend", "https://github.com/org/backend/pull/50"],
      ]),
    });

    // Step 3: Crash! Restart with same tickets
    const loaded = state.load(tickets);
    assert.ok(loaded, "should load saved state");

    // Verify prioritizer result preserved
    assert.equal(loaded.prioritizerResult.layers.length, 4);
    assert.equal(loaded.prioritizerResult.layers[3].group[0].key, "EC-10823");
    assert.equal(loaded.prioritizerResult.layers[3].group[1].key, "EC-10824");

    // Verify layer state has the merge chain from layers 0-2
    assert.equal(
      loaded.layerState.branches.get("/repo/storefront"),
      "EC-10822-merge-update-data-fetching",
    );
    assert.equal(
      loaded.layerState.branches.get("/repo/backend"),
      "EC-10822-merge-update-data-fetching",
    );
    assert.equal(
      loaded.layerState.prUrls.get("/repo/storefront"),
      "https://github.com/org/repo/pull/102",
    );

    // Layer 3 (EC-10823, EC-10824) can now build on this state
  });

  // ─── file content structure ─────────────────────────────────────────────────

  void it("writes valid JSON with ticketFingerprint", () => {
    const result = makePrioritizerResult(["EC-2", "EC-1"]);
    state.savePrioritizerResult(result, ["EC-2", "EC-1"]);

    const raw = JSON.parse(readFileSync(stateFile, "utf-8"));
    assert.equal(raw.ticketFingerprint, "EC-1,EC-2"); // sorted
    assert.ok(raw.prioritizerResult);
    assert.ok(raw.layerState);
  });
});
