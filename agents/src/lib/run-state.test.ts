import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, unlinkSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RunState } from "./run-state.js";
import type { PrioritizeResult } from "./prioritizer.js";
import type { GroupStates } from "./dag.js";

function makeResult(keys: string[]): PrioritizeResult {
  return {
    layers: [
      {
        group: keys.map((key) => ({
          key,
          repos: [{ repoPath: `/repo/${key}`, branch: `${key}-branch` }],
        })),
        relation: null,
        verification: { required: true, reason: "test" },
        dependsOn: null,
      },
    ],
    skipped: [],
    excluded: [],
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
    assert.equal(state.load(), null);
  });

  void it("returns null for corrupt JSON", () => {
    writeFileSync(stateFile, "not json");
    assert.equal(state.load(), null);
  });

  void it("returns null when saved state has missing fields", () => {
    writeFileSync(stateFile, JSON.stringify({ prioritizerResult: null }));
    assert.equal(state.load(), null);
  });

  // ─── save + load round-trip ────────────────────────────────────────────────

  void it("saves and loads prioritizer result", () => {
    state.save(makeResult(["EC-1", "EC-2"]));

    const loaded = state.load();
    assert.ok(loaded);
    assert.equal(loaded.prioritizerResult.layers[0].group[0].key, "EC-1");
    assert.equal(loaded.prioritizerResult.layers[0].group[1].key, "EC-2");
  });

  void it("initial groupStates is empty on fresh save", () => {
    state.save(makeResult(["EC-1"]));

    const loaded = state.load();
    assert.ok(loaded);
    assert.equal(loaded.groupStates.size, 0);
  });

  void it("save preserves existing groupStates", () => {
    state.save(makeResult(["EC-1"]));
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

    // Re-save with updated result — groupStates preserved
    state.save(makeResult(["EC-1", "EC-2"]));

    const loaded = state.load();
    assert.ok(loaded);
    assert.equal(loaded.prioritizerResult.layers[0].group.length, 2);
    assert.equal(loaded.groupStates.get("EC-1")?.branches.get("/repo"), "ec-1-merge");
  });

  // ─── updateGroupStates ─────────────────────────────────────────────────────

  void it("updates group states and preserves prioritizer result", () => {
    state.save(makeResult(["EC-1"]));
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
    assert.equal(loaded.prioritizerResult.layers[0].group[0].key, "EC-1");
  });

  void it("accumulates multiple group states", () => {
    state.save(makeResult(["EC-1", "EC-2"]));

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
    state.save(makeResult(["EC-1"]));
    state.clear();
    assert.equal(existsSync(stateFile), false);
  });

  void it("clear is safe when no file exists", () => {
    state.clear();
  });

  void it("load returns null after clear", () => {
    state.save(makeResult(["EC-1"]));
    state.clear();
    assert.equal(state.load(), null);
  });

  // ─── DAG resume scenario ───────────────────────────────────────────────────

  void it("full DAG resume: multiple groups with independent state", () => {
    const result: PrioritizeResult = {
      layers: [
        {
          group: [{ key: "EC-1", repos: [{ repoPath: "/storefront", branch: "ec-1-fix" }] }],
          relation: null,
          verification: { required: true, reason: "ui" },
          dependsOn: null,
        },
        {
          group: [{ key: "EC-2", repos: [{ repoPath: "/backend", branch: "ec-2-api" }] }],
          relation: null,
          verification: { required: false, reason: "api" },
          dependsOn: null,
        },
        {
          group: [{ key: "EC-3", repos: [{ repoPath: "/storefront", branch: "ec-3-ui" }] }],
          relation: null,
          verification: { required: true, reason: "ui" },
          dependsOn: "EC-1",
        },
      ],
      skipped: [],
      excluded: [],
    };

    state.save(result);

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

    // Crash! Re-save with guidance (maybe new ticket added)
    const updatedResult = { ...result };
    state.save(updatedResult);

    const loaded = state.load();
    assert.ok(loaded);

    // Group states preserved through re-save
    assert.equal(loaded.groupStates.size, 2);
    assert.equal(loaded.groupStates.get("EC-1")?.branches.get("/storefront"), "ec-1-merge");
    assert.equal(loaded.groupStates.get("EC-2")?.branches.get("/backend"), "ec-2-merge");

    // EC-3 depends on EC-1 — pipeline will look up EC-1's state
    assert.equal(loaded.prioritizerResult.layers[2].dependsOn, "EC-1");
  });

  // ─── file format ───────────────────────────────────────────────────────────

  void it("writes groupStates (not flat layerState) to disk", () => {
    state.save(makeResult(["EC-1"]));
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
});
