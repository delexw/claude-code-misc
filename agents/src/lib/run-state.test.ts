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

  // ─── pruneMergedGroups ────────────────────────────────────────────────────

  void it("prunes fully merged groups across multiple groups", () => {
    state.save(makeRawJson(["EC-1", "EC-2"]));
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

    // EC-1 merged, EC-2 open
    const pruned = state.pruneMergedGroups((url) => url === "https://pr/1");
    assert.deepEqual(pruned, ["EC-1"]);

    const loaded = state.load();
    assert.ok(loaded);
    assert.equal(loaded.groupStates.has("EC-1"), false);
    assert.equal(loaded.groupStates.has("EC-2"), true);
  });

  void it("removes only the merged repo from a group with mixed PR states", () => {
    state.save(makeRawJson(["EC-1"]));
    state.updateGroupStates(
      new Map([
        [
          "EC-1",
          {
            branches: new Map([
              ["/frontend", "ec-1-fe-merge"],
              ["/backend", "ec-1-be-merge"],
            ]),
            prUrls: new Map([
              ["/frontend", "https://pr/fe"],
              ["/backend", "https://pr/be"],
            ]),
          },
        ],
      ]),
    );

    // Frontend merged, backend still open
    const pruned = state.pruneMergedGroups((url) => url === "https://pr/fe");
    assert.deepEqual(pruned, []); // group not fully pruned

    const loaded = state.load();
    assert.ok(loaded);
    // Frontend removed — downstream won't re-use its branch
    assert.equal(loaded.groupStates.get("EC-1")?.prUrls.has("/frontend"), false);
    assert.equal(loaded.groupStates.get("EC-1")?.branches.has("/frontend"), false);
    // Backend preserved
    assert.equal(loaded.groupStates.get("EC-1")?.prUrls.get("/backend"), "https://pr/be");
    assert.equal(loaded.groupStates.get("EC-1")?.branches.get("/backend"), "ec-1-be-merge");
  });

  void it("moves fully pruned group to extraCompleted instead of clearing file", () => {
    state.save(makeRawJson(["EC-1"]));
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

    const pruned = state.pruneMergedGroups(() => true);
    assert.deepEqual(pruned, ["EC-1"]);

    // File still exists — EC-1 moved to extraCompleted for resumeInFlightTickets protection
    assert.equal(existsSync(stateFile), true);
    const raw = JSON.parse(readFileSync(stateFile, "utf-8")) as {
      groupStates: Record<string, unknown>;
      extraCompleted?: string[];
    };
    assert.deepEqual(raw.extraCompleted, ["EC-1"]);
    assert.deepEqual(raw.groupStates, {});
  });

  void it("does not prune groups with no PR URLs", () => {
    state.save(makeRawJson(["EC-1"]));
    state.updateGroupStates(
      new Map([["EC-1", { branches: new Map([["/repo", "ec-1-merge"]]), prUrls: new Map() }]]),
    );

    const pruned = state.pruneMergedGroups(() => true);
    assert.deepEqual(pruned, []);
    assert.ok(existsSync(stateFile));
  });

  void it("merges pruned group into extraCompleted alongside existing entries", () => {
    state.save(makeRawJson(["EC-1"]));
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
    state.markCompleted("EC-2"); // existing extraCompleted entry

    const pruned = state.pruneMergedGroups((url) => url === "https://pr/1");
    assert.deepEqual(pruned, ["EC-1"]);

    // Both EC-2 (pre-existing) and EC-1 (just merged) are in extraCompleted
    const raw = JSON.parse(readFileSync(stateFile, "utf-8")) as { extraCompleted?: string[] };
    assert.ok(raw.extraCompleted?.includes("EC-1"));
    assert.ok(raw.extraCompleted?.includes("EC-2"));
  });

  void it("returns empty array and is safe when no state file exists", () => {
    const pruned = state.pruneMergedGroups(() => true);
    assert.deepEqual(pruned, []);
  });

  void it("pruneExtraCompleted keeps merged-PR ticket while still in sprint (In Review)", () => {
    // Simulate: EC-1 PR merged → pruneMergedGroups moved it to extraCompleted
    state.save(makeRawJson(["EC-1"]));
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
    state.pruneMergedGroups(() => true); // EC-1 → extraCompleted

    // Next discover: EC-1 is "In Review" — still in allKeys but not in pending
    // pruneExtraCompleted with allKeys must KEEP EC-1 so resumeInFlightTickets sees it as completed
    state.pruneExtraCompleted(new Set(["EC-1"])); // allKeys includes EC-1 (In Review)

    assert.ok(state.completedTicketKeys().has("EC-1"), "EC-1 must stay in completed");
  });

  void it("pruneExtraCompleted removes merged-PR ticket when it leaves the sprint", () => {
    state.save(makeRawJson(["EC-1"]));
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
    state.pruneMergedGroups(() => true); // EC-1 → extraCompleted

    // EC-1 is no longer assigned to me / left sprint — not in allKeys
    state.pruneExtraCompleted(new Set([]));

    assert.ok(!state.completedTicketKeys().has("EC-1"), "EC-1 removed once out of sprint");
  });

  // ─── save preserves extraCompleted ───────────────────────────────────────

  void it("save preserves extraCompleted across re-save", () => {
    state.save(makeRawJson(["EC-1"]));
    state.markCompleted("EC-2");

    // Re-save with new raw JSON — extraCompleted must survive
    state.save(makeRawJson(["EC-1", "EC-3"]));

    const raw = JSON.parse(readFileSync(stateFile, "utf-8")) as { extraCompleted?: string[] };
    assert.deepEqual(raw.extraCompleted, ["EC-2"]);
  });

  void it("save omits extraCompleted field when there are no extra-completed keys", () => {
    state.save(makeRawJson(["EC-1"]));
    state.save(makeRawJson(["EC-1", "EC-2"]));

    const raw = JSON.parse(readFileSync(stateFile, "utf-8")) as { extraCompleted?: string[] };
    assert.equal(raw.extraCompleted, undefined);
  });

  // ─── pruneExtraCompleted ──────────────────────────────────────────────────

  void it("pruneExtraCompleted removes keys no longer in sprint (allKeys)", () => {
    state.save(makeRawJson(["EC-1"]));
    state.markCompleted("EC-2");
    state.markCompleted("EC-3");

    // Only EC-3 is still in the sprint
    state.pruneExtraCompleted(new Set(["EC-3"]));

    const raw = JSON.parse(readFileSync(stateFile, "utf-8")) as { extraCompleted?: string[] };
    assert.deepEqual(raw.extraCompleted, ["EC-3"]);
  });

  void it("pruneExtraCompleted removes extraCompleted field when all keys left the sprint", () => {
    state.save(makeRawJson(["EC-1"]));
    state.markCompleted("EC-2");

    // EC-2 is no longer in the sprint
    state.pruneExtraCompleted(new Set(["EC-1"]));

    const raw = JSON.parse(readFileSync(stateFile, "utf-8")) as { extraCompleted?: string[] };
    assert.equal(raw.extraCompleted, undefined);
  });

  void it("pruneExtraCompleted is a no-op when nothing needs pruning", () => {
    state.save(makeRawJson(["EC-1"]));
    state.markCompleted("EC-2");

    const before = readFileSync(stateFile, "utf-8");
    state.pruneExtraCompleted(new Set(["EC-1", "EC-2"]));
    const after = readFileSync(stateFile, "utf-8");

    assert.equal(before, after);
  });

  void it("pruneExtraCompleted is a no-op when no state file exists", () => {
    state.pruneExtraCompleted(new Set(["EC-1"]));
    assert.equal(existsSync(stateFile), false);
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
