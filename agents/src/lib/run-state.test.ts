import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, unlinkSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RunState } from "./run-state.js";
import type { GroupStates } from "./dag.js";

function makeRawJson(keys: string[]): string {
  return JSON.stringify({
    layers: [
      {
        group: keys.map((key) => ({
          key,
          repos: [{ repo: key.toLowerCase(), branch: `${key}-branch` }],
        })),
        relation: null,
        verification: { required: true, reason: "test" },
        depends_on: null,
      },
    ],
    skipped: [],
    excluded: [],
  });
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
    assert.equal(state.load(), null);
  });

  void it("returns null for corrupt JSON", () => {
    writeFileSync(stateFile, "not json");
    assert.equal(state.load(), null);
  });

  void it("returns null when saved state has missing fields", () => {
    writeFileSync(stateFile, JSON.stringify({ prioritizerRawJson: null }));
    assert.equal(state.load(), null);
  });

  // ─── save + load round-trip ────────────────────────────────────────────────

  void it("saves and loads prioritizer raw JSON", () => {
    const rawJson = makeRawJson(["EC-1", "EC-2"]);
    state.save(rawJson);

    const loaded = state.load();
    assert.ok(loaded);
    assert.equal(loaded.prioritizerRawJson, rawJson);
  });

  void it("initial groupStates is empty on fresh save", () => {
    state.save(makeRawJson(["EC-1"]));

    const loaded = state.load();
    assert.ok(loaded);
    assert.equal(loaded.groupStates.size, 0);
  });

  void it("save preserves existing groupStates", () => {
    state.save(makeRawJson(["EC-1"]));
    const gs: GroupStates = new Map([
      [
        "EC-1",
        {
          branches: new Map([["/repo", "ec-1-merge"]]),
          prUrls: new Map([["/repo", "https://pr/1"]]),
        },
      ],
    ]);
    state.updateGroupStates(gs);

    // Re-save with updated raw JSON — groupStates preserved
    state.save(makeRawJson(["EC-1", "EC-2"]));

    const loaded = state.load();
    assert.ok(loaded);
    assert.equal(loaded.groupStates.get("EC-1")?.branches.get("/repo"), "ec-1-merge");
  });

  // ─── updateGroupStates ─────────────────────────────────────────────────────

  void it("updates group states and preserves prioritizer raw JSON", () => {
    const rawJson = makeRawJson(["EC-1"]);
    state.save(rawJson);
    state.updateGroupStates(
      new Map([
        [
          "EC-1",
          {
            branches: new Map([["/repo", "ec-1-merge"]]),
            prUrls: new Map([["/repo", "https://pr/1"]]),
          },
        ],
      ]),
    );

    const loaded = state.load();
    assert.ok(loaded);
    assert.equal(loaded.groupStates.get("EC-1")?.branches.get("/repo"), "ec-1-merge");
    assert.equal(loaded.prioritizerRawJson, rawJson);
  });

  void it("accumulates multiple group states", () => {
    state.save(makeRawJson(["EC-1", "EC-2"]));

    state.updateGroupStates(
      new Map([["EC-1", { branches: new Map([["/repo", "ec-1-merge"]]), prUrls: new Map() }]]),
    );

    // Second update adds EC-2 alongside EC-1
    state.updateGroupStates(
      new Map([
        [
          "EC-1",
          {
            branches: new Map([["/repo", "ec-1-merge"]]),
            prUrls: new Map([["/repo", "https://pr/1"]]),
          },
        ],
        [
          "EC-2",
          {
            branches: new Map([["/repo", "ec-2-merge"]]),
            prUrls: new Map([["/repo", "https://pr/2"]]),
          },
        ],
      ]),
    );

    const loaded = state.load();
    assert.ok(loaded);
    assert.equal(loaded.groupStates.size, 2);
    assert.equal(loaded.groupStates.get("EC-1")?.prUrls.get("/repo"), "https://pr/1");
    assert.equal(loaded.groupStates.get("EC-2")?.branches.get("/repo"), "ec-2-merge");
  });

  void it("updateGroupStates is a no-op when no state file exists", () => {
    state.updateGroupStates(new Map([["EC-1", { branches: new Map(), prUrls: new Map() }]]));
    assert.equal(existsSync(stateFile), false);
  });

  // ─── clear ──────────────────────────────────────────────────────────────────

  void it("clear removes the state file", () => {
    state.save(makeRawJson(["EC-1"]));
    state.clear();
    assert.equal(existsSync(stateFile), false);
  });

  void it("clear is safe when no file exists", () => {
    state.clear();
  });

  void it("load returns null after clear", () => {
    state.save(makeRawJson(["EC-1"]));
    state.clear();
    assert.equal(state.load(), null);
  });

  // ─── DAG resume scenario ───────────────────────────────────────────────────

  void it("full DAG resume: multiple groups with independent state", () => {
    const rawJson = makeRawJson(["EC-1"]);
    state.save(rawJson);

    // Groups EC-1 and EC-2 complete
    state.updateGroupStates(
      new Map([
        [
          "EC-1",
          {
            branches: new Map([["/storefront", "ec-1-merge"]]),
            prUrls: new Map([["/storefront", "https://pr/1"]]),
          },
        ],
        [
          "EC-2",
          {
            branches: new Map([["/backend", "ec-2-merge"]]),
            prUrls: new Map([["/backend", "https://pr/2"]]),
          },
        ],
      ]),
    );

    // Crash! Re-save with guidance
    state.save(makeRawJson(["EC-1", "EC-3"]));

    const loaded = state.load();
    assert.ok(loaded);

    // Group states preserved through re-save
    assert.equal(loaded.groupStates.size, 2);
    assert.equal(loaded.groupStates.get("EC-1")?.branches.get("/storefront"), "ec-1-merge");
    assert.equal(loaded.groupStates.get("EC-2")?.branches.get("/backend"), "ec-2-merge");
  });

  // ─── file format ───────────────────────────────────────────────────────────

  void it("writes groupStates (not flat layerState) to disk", () => {
    state.save(makeRawJson(["EC-1"]));
    state.updateGroupStates(
      new Map([["EC-1", { branches: new Map([["/repo", "branch"]]), prUrls: new Map() }]]),
    );

    const raw = JSON.parse(readFileSync(stateFile, "utf-8")) as {
      groupStates?: { [k: string]: { branches: { [k: string]: string } } };
      layerState?: unknown;
    };
    assert.ok(raw.groupStates);
    assert.ok(raw.groupStates["EC-1"]);
    assert.equal(raw.groupStates["EC-1"].branches["/repo"], "branch");
    assert.equal(raw.layerState, undefined);
  });

  // ─── backward compat ──────────────────────────────────────────────────────

  void it("returns null for old format with prioritizerResult instead of prioritizerRawJson", () => {
    writeFileSync(
      stateFile,
      JSON.stringify({ prioritizerResult: { layers: [] }, groupStates: {} }),
    );
    assert.equal(state.load(), null);
  });
});
