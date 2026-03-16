import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeAndVerify, processLayers } from "./pipeline.js";
import type { GroupStates, LayerState } from "./dag.js";
import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { DevServerManager } from "./dev-servers.js";
import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";
import type { ForgeResult } from "./prompts.js";
import type { GroupedLayer, Verification } from "./prioritizer.js";

const NO_BASE: LayerState = { branches: new Map(), prUrls: new Map() };
const VERIFY: Verification = { required: true, reason: "test" };
const NO_VERIFY: Verification = { required: false, reason: "test" };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function collectLogs(): { logs: string[]; log: LogFn } {
  const logs: string[] = [];
  return { logs, log: (msg: string) => logs.push(msg) };
}

function makeRunner(responses: Array<{ code: number; stdout: string }>): ClaudeRunner {
  let callIndex = 0;
  return {
    run: async () => responses[callIndex++] ?? { code: 0, stdout: "" },
    writeLog: () => "/fake/log",
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
  } as unknown as ClaudeRunner;
}

function makeDevServers(devUrl = "http://localhost:3000"): DevServerManager {
  return {
    devUrl,
    startAll: async () => {},
    stopAll: () => {},
    restartOnBranch: async () => {},
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
  } as unknown as DevServerManager;
}

function makeJira(): JiraClient {
  return {
    ticketUrl: (key: string) => `https://jira/${key}`,
    moveTicket: async () => true,
    getParentKey: async () => null,
    hasUnfinishedSubtasks: async () => true,
    promoteToReview: async () => {},
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
  } as unknown as JiraClient;
}

function makeTracker(): ProcessedTracker & { marked: string[] } {
  const marked: string[] = [];
  return {
    marked,
    mark: (key: string) => marked.push(key),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
  } as unknown as ProcessedTracker & { marked: string[] };
}

// ─── mergeAndVerify ──────────────────────────────────────────────────────────

void describe("mergeAndVerify", () => {
  const successForges: ForgeResult[] = [
    {
      ticketKey: "EC-1",
      status: "success",
      worktrees: [{ repoPath: "/repo", worktreePath: "/wt/ec-1" }],
    },
    {
      ticketKey: "EC-2",
      status: "success",
      worktrees: [{ repoPath: "/repo", worktreePath: "/wt/ec-2" }],
    },
  ];

  void it("returns all succeeded when merge, verify, and PR pass", async () => {
    const runner = makeRunner([
      { code: 0, stdout: "" }, // commit EC-1
      { code: 0, stdout: "" }, // commit EC-2
      { code: 0, stdout: "EC-1-merge-branch" }, // merge
      { code: 0, stdout: "verify ok" }, // verify
      { code: 0, stdout: "pr created" }, // PR
    ]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      successForges,
      [
        { key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
        { key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
      ],
      ["/repo"],
      VERIFY,
      NO_BASE,
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.deepEqual(result.succeeded, ["EC-1", "EC-2"]);
    assert.deepEqual(result.failed, []);
  });

  void it("returns all failed when no successful forges", async () => {
    const forges: ForgeResult[] = [{ ticketKey: "EC-1", status: "failed", worktrees: [] }];
    const runner = makeRunner([]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      forges,
      [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
      ["/repo"],
      VERIFY,
      NO_BASE,
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.deepEqual(result.succeeded, []);
    assert.deepEqual(result.failed, ["EC-1"]);
  });

  void it("returns all failed when merge fails", async () => {
    const runner = makeRunner([
      { code: 0, stdout: "" }, // commit EC-1
      { code: 0, stdout: "" }, // commit EC-2
      { code: 1, stdout: "" }, // merge fails
    ]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      successForges,
      [
        { key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
        { key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
      ],
      ["/repo"],
      VERIFY,
      NO_BASE,
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.deepEqual(result.succeeded, []);
    assert.ok(result.failed.includes("EC-1"));
    assert.ok(result.failed.includes("EC-2"));
  });

  void it("separates failed forges from successful ones in result", async () => {
    const mixed: ForgeResult[] = [
      {
        ticketKey: "EC-1",
        status: "success",
        worktrees: [{ repoPath: "/repo", worktreePath: "/wt/ec-1" }],
      },
      { ticketKey: "EC-2", status: "failed", worktrees: [] },
    ];
    const runner = makeRunner([
      { code: 0, stdout: "" }, // commit EC-1
      { code: 0, stdout: "merge-branch" },
      { code: 0, stdout: "verify ok" },
      { code: 0, stdout: "pr ok" },
    ]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      mixed,
      [
        { key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
        { key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
      ],
      ["/repo"],
      VERIFY,
      NO_BASE,
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.deepEqual(result.succeeded, ["EC-1"]);
    assert.deepEqual(result.failed, ["EC-2"]);
  });

  void it("marks successful tickets in tracker", async () => {
    const runner = makeRunner([
      { code: 0, stdout: "" }, // commit EC-1
      { code: 0, stdout: "" }, // commit EC-2
      { code: 0, stdout: "branch" },
      { code: 0, stdout: "ok" },
      { code: 0, stdout: "ok" },
    ]);
    const tracker = makeTracker();
    const { log } = collectLogs();

    await mergeAndVerify(
      successForges,
      [
        { key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
        { key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
      ],
      ["/repo"],
      VERIFY,
      NO_BASE,
      runner,
      makeDevServers(),
      makeJira(),
      tracker,
      log,
    );

    assert.deepEqual(tracker.marked, ["EC-1", "EC-2"]);
  });

  void it("moves tickets to In Review via jira", async () => {
    const movedTickets: string[] = [];
    const jira = {
      ticketUrl: () => "",
      moveTicket: async (key: string) => {
        movedTickets.push(key);
        return true;
      },
      getParentKey: async () => null,
      hasUnfinishedSubtasks: async () => true,
      promoteToReview: async (key: string) => {
        movedTickets.push(key);
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as JiraClient;

    const runner = makeRunner([
      { code: 0, stdout: "" }, // commit EC-1
      { code: 0, stdout: "" }, // commit EC-2
      { code: 0, stdout: "branch" },
      { code: 0, stdout: "ok" },
      { code: 0, stdout: "ok" },
    ]);
    const { log } = collectLogs();

    await mergeAndVerify(
      successForges,
      [
        { key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
        { key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
      ],
      ["/repo"],
      VERIFY,
      NO_BASE,
      runner,
      makeDevServers(),
      jira,
      makeTracker(),
      log,
    );

    assert.deepEqual(movedTickets, ["EC-1", "EC-2"]);
  });

  void it("always runs verify even when verification.required is false", async () => {
    let runCallCount = 0;
    const runner = {
      run: async () => {
        runCallCount++;
        return { code: 0, stdout: "branch" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;
    const { log } = collectLogs();

    await mergeAndVerify(
      [successForges[0]],
      [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
      ["/repo"],
      NO_VERIFY,
      NO_BASE,
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    // commit + merge + verify + PR = 4 calls (verify always runs)
    assert.equal(runCallCount, 4);
  });

  void it("calls restartOnBranch when needsVerification and merge succeeds", async () => {
    let restartedBranch = "";
    const devServers = {
      devUrl: "http://localhost:3000",
      startAll: async () => {},
      stopAll: () => {},
      restartOnBranch: async (branch: string) => {
        restartedBranch = branch;
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as DevServerManager;

    const runner = makeRunner([
      { code: 0, stdout: "" }, // commit EC-1
      { code: 0, stdout: "my-merge-branch" },
      { code: 0, stdout: "ok" },
      { code: 0, stdout: "ok" },
    ]);
    const { log } = collectLogs();

    await mergeAndVerify(
      [successForges[0]],
      [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
      ["/repo"],
      VERIFY,
      NO_BASE,
      runner,
      devServers,
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(restartedBranch, "my-merge-branch");
  });

  void it("does not restart servers when needsVerification is false", async () => {
    let restarted = false;
    const devServers = {
      devUrl: "http://localhost:3000",
      startAll: async () => {},
      stopAll: () => {},
      restartOnBranch: async () => {
        restarted = true;
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as DevServerManager;

    const runner = makeRunner([
      { code: 0, stdout: "" }, // commit EC-1
      { code: 0, stdout: "branch" },
      { code: 0, stdout: "ok" },
    ]);
    const { log } = collectLogs();

    await mergeAndVerify(
      [successForges[0]],
      [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
      ["/repo"],
      NO_VERIFY,
      NO_BASE,
      runner,
      devServers,
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(restarted, false);
  });

  void it("logs warning when jira promoteToReview fails", async () => {
    const jira = {
      ticketUrl: () => "",
      moveTicket: async () => false,
      getParentKey: async () => null,
      hasUnfinishedSubtasks: async () => true,
      promoteToReview: async (key: string, logFn: (msg: string) => void) => {
        logFn(`WARN: Could not move ${key} to In Review`);
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as JiraClient;

    const runner = makeRunner([
      { code: 0, stdout: "" }, // commit EC-1
      { code: 0, stdout: "branch" },
      { code: 0, stdout: "ok" },
      { code: 0, stdout: "ok" },
    ]);
    const { logs, log } = collectLogs();

    await mergeAndVerify(
      [successForges[0]],
      [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
      ["/repo"],
      VERIFY,
      NO_BASE,
      runner,
      makeDevServers(),
      jira,
      makeTracker(),
      log,
    );

    assert.ok(logs.some((l) => l.includes("WARN: Could not move EC-1")));
  });

  void it("still succeeds when verify fails", async () => {
    const runner = makeRunner([
      { code: 0, stdout: "" }, // commit EC-1
      { code: 0, stdout: "branch" },
      { code: 1, stdout: "verify failed" }, // verify fails
      { code: 0, stdout: "pr ok" },
    ]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      [successForges[0]],
      [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
      ["/repo"],
      VERIFY,
      NO_BASE,
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.deepEqual(result.succeeded, ["EC-1"]);
  });

  void it("still succeeds when PR creation fails", async () => {
    const runner = makeRunner([
      { code: 0, stdout: "" }, // commit EC-1
      { code: 0, stdout: "branch" },
      { code: 0, stdout: "ok" },
      { code: 1, stdout: "pr failed" }, // PR fails
    ]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      [successForges[0]],
      [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
      ["/repo"],
      VERIFY,
      NO_BASE,
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.deepEqual(result.succeeded, ["EC-1"]);
  });
});

// ─── processLayers ───────────────────────────────────────────────────────────

void describe("processLayers", () => {
  // processLayers calls processGroup → forgeGroup → forgeTicket → runner.run
  // We need a runner that handles the full sequence: forge per ticket + merge + verify + PR

  function makeFullRunner(forgeCode = 0): ClaudeRunner {
    return {
      run: async (_prompt: string, opts: { taskName: string }) => {
        if (opts.taskName.includes("forge")) {
          return { code: forgeCode, stdout: '{"worktree_path": "/wt/t"}' };
        }
        return { code: 0, stdout: "branch-name" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;
  }

  void it("processes all layers and counts results", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
    ];
    const runner = makeFullRunner();
    const { log } = collectLogs();

    const result = await processLayers(
      layers,
      new Set(["EC-1", "EC-2"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(result.succeeded, 2);
    assert.equal(result.failed, 0);
  });

  void it("skips empty layers after filtering", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-99", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      }, // not in unprocessed
    ];
    const runner = makeFullRunner();
    const { logs, log } = collectLogs();

    const result = await processLayers(
      layers,
      new Set(["EC-1"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(result.succeeded, 1);
    assert.ok(!logs.some((l) => l.includes("EC-99")));
  });

  void it("respects skipped and excluded sets", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [
          { key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
          { key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
          { key: "EC-3", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] },
        ],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
    ];
    const runner = makeFullRunner();
    const { log } = collectLogs();

    const result = await processLayers(
      layers,
      new Set(["EC-1", "EC-2", "EC-3"]),
      new Set(["EC-2"]),
      new Set(["EC-3"]),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    // Only EC-1 should be processed
    assert.equal(result.succeeded, 1);
  });

  void it("counts failures from forge errors", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
    ];
    const runner = makeFullRunner(1); // forge fails
    const { log } = collectLogs();

    const result = await processLayers(
      layers,
      new Set(["EC-1"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(result.succeeded, 0);
    assert.equal(result.failed, 1);
  });

  void it("returns zeros for empty layers", async () => {
    const runner = makeFullRunner();
    const { log } = collectLogs();

    const result = await processLayers(
      [],
      new Set(),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(result.succeeded, 0);
    assert.equal(result.failed, 0);
  });

  void it("logs layer info with relation", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: "same-epic",
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
    ];
    const runner = makeFullRunner();
    const { logs, log } = collectLogs();

    await processLayers(
      layers,
      new Set(["EC-1"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.ok(logs.some((l) => l.includes("Layer 0") && l.includes("(same-epic)")));
  });

  void it("logs layer info without relation when null", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
    ];
    const runner = makeFullRunner();
    const { logs, log } = collectLogs();

    await processLayers(
      layers,
      new Set(["EC-1"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    const layerLog = logs.find((l) => l.includes("Layer 0"));
    assert.ok(layerLog);
    assert.ok(!layerLog.includes("("));
  });

  void it("threads baseBranch and PR URL via dependsOn (stacked chain)", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-10", repos: [{ repoPath: "/repo", branch: "ec-10-auth" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-20", repos: [{ repoPath: "/repo", branch: "ec-20-rate-limit" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-10",
      },
    ];

    const layer0PrJson = JSON.stringify({
      pr_url: "https://github.com/org/repo/pull/42",
      pr_number: 42,
      title: "[EC-10]: Fix auth",
      status: "success",
    });

    // Capture every prompt+taskName pair
    const calls: Array<{ prompt: string; taskName: string }> = [];
    const runner = {
      run: async (prompt: string, opts: { taskName: string }) => {
        calls.push({ prompt, taskName: opts.taskName });
        if (opts.taskName.includes("forge")) {
          return { code: 0, stdout: "" };
        }
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-10")) {
          return { code: 0, stdout: "ec-10-merge" };
        }
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-20")) {
          return { code: 0, stdout: "ec-20-merge" };
        }
        // Layer 0 PR returns JSON with pr_url
        if (opts.taskName.includes("pr") && opts.taskName.includes("EC-10")) {
          return { code: 0, stdout: layer0PrJson };
        }
        return { code: 0, stdout: "ok" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;

    const { log } = collectLogs();

    await processLayers(
      layers,
      new Set(["EC-10", "EC-20"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    // --- Layer 0: merge should branch from "main" (default) ---
    const layer0Merge = calls.find(
      (c) => c.taskName.includes("merge") && c.taskName.includes("EC-10"),
    );
    assert.ok(layer0Merge, "layer 0 merge call must exist");
    assert.ok(
      layer0Merge.prompt.includes('from "main"'),
      `layer 0 merge should branch from main, got: ${layer0Merge.prompt}`,
    );

    // --- Layer 1: merge should branch from "ec-10-merge" (layer 0's output) ---
    const layer1Merge = calls.find(
      (c) => c.taskName.includes("merge") && c.taskName.includes("EC-20"),
    );
    assert.ok(layer1Merge, "layer 1 merge call must exist");
    assert.ok(
      layer1Merge.prompt.includes('from "ec-10-merge"'),
      `layer 1 merge should branch from ec-10-merge, got: ${layer1Merge.prompt}`,
    );

    // --- Layer 0: PR should target main (no stacked PR note) ---
    const layer0Pr = calls.find((c) => c.taskName.includes("pr") && c.taskName.includes("EC-10"));
    assert.ok(layer0Pr, "layer 0 PR call must exist");
    assert.ok(!layer0Pr.prompt.includes("stacked PR"), "layer 0 PR should NOT be a stacked PR");
    assert.ok(layer0Pr.prompt.includes('"main"'), "layer 0 PR base branch should be main");

    // --- Layer 1: PR should reference layer 0's PR URL ---
    const layer1Pr = calls.find((c) => c.taskName.includes("pr") && c.taskName.includes("EC-20"));
    assert.ok(layer1Pr, "layer 1 PR call must exist");
    assert.ok(layer1Pr.prompt.includes("stacked PR"), "layer 1 PR should be marked as stacked");
    assert.ok(
      layer1Pr.prompt.includes("ec-10-merge"),
      "layer 1 PR should reference ec-10-merge as base branch",
    );
    assert.ok(
      layer1Pr.prompt.includes("https://github.com/org/repo/pull/42"),
      "layer 1 PR should include layer 0's PR URL in dependency note",
    );
  });

  void it("independent groups (no dependsOn) branch from main", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-2-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
        // No dependsOn — independent
      },
    ];

    const calls: Array<{ prompt: string; taskName: string }> = [];
    const runner = {
      run: async (prompt: string, opts: { taskName: string }) => {
        calls.push({ prompt, taskName: opts.taskName });
        if (opts.taskName.includes("forge")) return { code: 0, stdout: "" };
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-1"))
          return { code: 0, stdout: "ec-1-merge" };
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-2"))
          return { code: 0, stdout: "ec-2-merge" };
        return { code: 0, stdout: "ok" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;

    const { log } = collectLogs();
    await processLayers(
      layers,
      new Set(["EC-1", "EC-2"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    // Both merges should branch from main (no dependency)
    const ec1Merge = calls.find((c) => c.taskName.includes("merge") && c.taskName.includes("EC-1"));
    const ec2Merge = calls.find((c) => c.taskName.includes("merge") && c.taskName.includes("EC-2"));
    assert.ok(ec1Merge);
    assert.ok(ec2Merge);
    assert.ok(ec1Merge.prompt.includes('from "main"'), "EC-1 should branch from main");
    assert.ok(
      ec2Merge.prompt.includes('from "main"'),
      "EC-2 should branch from main (independent)",
    );
  });

  void it("skips downstream groups when dependency fails", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-2-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-1",
      },
    ];
    const runner = makeFullRunner(1); // all forges fail
    const { logs, log } = collectLogs();

    const result = await processLayers(
      layers,
      new Set(["EC-1", "EC-2"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(result.succeeded, 0);
    assert.equal(result.failed, 2);
    assert.ok(logs.some((l) => l.includes("EC-1") && l.includes("failed")));
    assert.ok(logs.some((l) => l.includes("SKIP") && l.includes("EC-1") && l.includes("failed")));
  });

  void it("independent group continues when sibling fails", async () => {
    // EC-1 fails, EC-2 is independent (no dependsOn) → should still run
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-2-fix" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
        // No dependsOn — independent of EC-1
      },
    ];

    const runner = {
      run: async (_prompt: string, opts: { taskName: string }) => {
        // EC-1 forge fails, EC-2 forge succeeds
        if (opts.taskName.includes("forge") && opts.taskName.includes("EC-1"))
          return { code: 1, stdout: "" };
        if (opts.taskName.includes("forge"))
          return { code: 0, stdout: '{"worktree_path": "/wt/t"}' };
        return { code: 0, stdout: "branch-name" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;

    const { log } = collectLogs();
    const result = await processLayers(
      layers,
      new Set(["EC-1", "EC-2"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(result.succeeded, 1);
    assert.equal(result.failed, 1);
  });

  void it("transitive failure: A → B → C, A fails, both B and C are skipped", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-A", repos: [{ repoPath: "/repo", branch: "ec-a" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-B", repos: [{ repoPath: "/repo", branch: "ec-b" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-A",
      },
      {
        group: [{ key: "EC-C", repos: [{ repoPath: "/repo", branch: "ec-c" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-B",
      },
    ];
    const runner = makeFullRunner(1); // forge fails
    const { logs, log } = collectLogs();

    const result = await processLayers(
      layers,
      new Set(["EC-A", "EC-B", "EC-C"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(result.succeeded, 0);
    assert.equal(result.failed, 3);
    // EC-B skipped because EC-A failed
    assert.ok(logs.some((l) => l.includes("SKIP") && l.includes("EC-A")));
    // EC-C skipped because EC-B failed (transitive)
    assert.ok(logs.some((l) => l.includes("SKIP") && l.includes("EC-B")));
  });

  void it("diamond: two groups depend on same parent, both get parent state", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-ROOT", repos: [{ repoPath: "/repo", branch: "ec-root" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-LEFT", repos: [{ repoPath: "/repo", branch: "ec-left" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-ROOT",
      },
      {
        group: [{ key: "EC-RIGHT", repos: [{ repoPath: "/repo", branch: "ec-right" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-ROOT",
      },
    ];

    const calls: Array<{ prompt: string; taskName: string }> = [];
    const runner = {
      run: async (prompt: string, opts: { taskName: string }) => {
        calls.push({ prompt, taskName: opts.taskName });
        if (opts.taskName.includes("forge")) return { code: 0, stdout: "" };
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-ROOT"))
          return { code: 0, stdout: "root-merge" };
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-LEFT"))
          return { code: 0, stdout: "left-merge" };
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-RIGHT"))
          return { code: 0, stdout: "right-merge" };
        return { code: 0, stdout: "ok" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;

    const { log } = collectLogs();
    const result = await processLayers(
      layers,
      new Set(["EC-ROOT", "EC-LEFT", "EC-RIGHT"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(result.succeeded, 3);

    // Both LEFT and RIGHT should merge from root-merge (not from each other)
    const leftMerge = calls.find(
      (c) => c.taskName.includes("merge") && c.taskName.includes("EC-LEFT"),
    );
    const rightMerge = calls.find(
      (c) => c.taskName.includes("merge") && c.taskName.includes("EC-RIGHT"),
    );
    assert.ok(leftMerge);
    assert.ok(rightMerge);
    assert.ok(leftMerge.prompt.includes('from "root-merge"'), "LEFT should merge from root-merge");
    assert.ok(
      rightMerge.prompt.includes('from "root-merge"'),
      "RIGHT should merge from root-merge",
    );
  });

  void it("logs dependsOn in layer info", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-2" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-1",
      },
    ];
    const runner = makeFullRunner();
    const { logs, log } = collectLogs();

    await processLayers(
      layers,
      new Set(["EC-1", "EC-2"]),
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    const layer1Log = logs.find((l) => l.includes("Layer 1"));
    assert.ok(layer1Log);
    assert.ok(layer1Log.includes("→EC-1"), `should log dependency, got: ${layer1Log}`);
  });

  void it("resume: filtered-empty layers use persisted initialGroupStates via dependsOn", async () => {
    // Simulate restart: layers 0-1 already processed, layer 2 depends on layer 1
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-10", repos: [{ repoPath: "/repo", branch: "ec-10" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-20", repos: [{ repoPath: "/repo", branch: "ec-20" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-10",
      },
      {
        group: [{ key: "EC-30", repos: [{ repoPath: "/repo", branch: "ec-30" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-20",
      },
    ];

    // EC-10 and EC-20 already processed — only EC-30 is unprocessed
    const unprocessed = new Set(["EC-30"]);

    // Persisted group states from the previous run
    const initialGroupStates: GroupStates = new Map([
      [
        "EC-10",
        {
          branches: new Map([["/repo", "ec-10-merge"]]),
          prUrls: new Map([["/repo", "https://pr/10"]]),
        },
      ],
      [
        "EC-20",
        {
          branches: new Map([["/repo", "ec-20-merge"]]),
          prUrls: new Map([["/repo", "https://pr/20"]]),
        },
      ],
    ]);

    const calls: Array<{ prompt: string; taskName: string }> = [];
    const runner = {
      run: async (prompt: string, opts: { taskName: string }) => {
        calls.push({ prompt, taskName: opts.taskName });
        if (opts.taskName.includes("forge")) return { code: 0, stdout: "" };
        if (opts.taskName.includes("merge")) return { code: 0, stdout: "ec-30-merge" };
        return { code: 0, stdout: "ok" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;

    const { log } = collectLogs();
    const result = await processLayers(
      layers,
      unprocessed,
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
      initialGroupStates,
    );

    assert.equal(result.succeeded, 1);
    assert.equal(result.failed, 0);

    // EC-30's merge should branch from EC-20's merge branch (via dependsOn → groupStates)
    const ec30Merge = calls.find(
      (c) => c.taskName.includes("merge") && c.taskName.includes("EC-30"),
    );
    assert.ok(ec30Merge, "EC-30 merge call must exist");
    assert.ok(
      ec30Merge.prompt.includes('from "ec-20-merge"'),
      `EC-30 should merge from ec-20-merge, got: ${ec30Merge.prompt}`,
    );
  });

  void it("resume: pk uses unfiltered primary key so dependsOn references stay valid", async () => {
    // Group has [EC-1, EC-2], but EC-1 is filtered out. dependsOn should still reference "EC-1".
    const layers: GroupedLayer[] = [
      {
        group: [
          { key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1" }] },
          { key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-2" }] },
        ],
        relation: "same-epic",
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-3", repos: [{ repoPath: "/repo", branch: "ec-3" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-1", // references the group by its original primary key
      },
    ];

    // EC-1 already processed, only EC-2 and EC-3 unprocessed
    const unprocessed = new Set(["EC-2", "EC-3"]);

    const calls: Array<{ prompt: string; taskName: string }> = [];
    const runner = {
      run: async (prompt: string, opts: { taskName: string }) => {
        calls.push({ prompt, taskName: opts.taskName });
        if (opts.taskName.includes("forge")) return { code: 0, stdout: "" };
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-2"))
          return { code: 0, stdout: "ec-1-group-merge" };
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-3"))
          return { code: 0, stdout: "ec-3-merge" };
        return { code: 0, stdout: "ok" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;

    const { log } = collectLogs();
    const result = await processLayers(
      layers,
      unprocessed,
      new Set(),
      new Set(),
      ["/repo"],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(result.succeeded, 2);

    // EC-3 should merge from ec-1-group-merge (the group keyed by "EC-1", not "EC-2")
    const ec3Merge = calls.find((c) => c.taskName.includes("merge") && c.taskName.includes("EC-3"));
    assert.ok(ec3Merge);
    assert.ok(
      ec3Merge.prompt.includes('from "ec-1-group-merge"'),
      `EC-3 should merge from ec-1-group-merge, got: ${ec3Merge.prompt}`,
    );
  });
});

// ─── Real-world DAG scenario (from actual GSD run) ──────────────────────────

void describe("real-world: EC-10798 team tabs resume", () => {
  //
  // Previous run processed 4 groups:
  //   L0: [EC-10819]             (root, storefront)
  //   L1: [EC-10821, EC-10820]   (depends on EC-10819, storefront)
  //   L2: [EC-10822]             (depends on EC-10821, storefront + backend)
  //   L3: [EC-10823, EC-10824]   (depends on EC-10822, storefront)
  //
  // L0-L2 completed. L3 crashed mid-flight.
  // Restart: prioritizer re-runs with guidance, produces:
  //   layers: [{ group: [EC-10823, EC-10824], depends_on: "EC-10822" }]
  // Only EC-10823/EC-10824 are unprocessed.
  //
  // Persisted groupStates from previous run:
  //   EC-10819 → storefront: "EC-10819-merge-add-team-tabs"
  //   EC-10821 → storefront: "EC-10821-merge-add-tab-state"
  //   EC-10822 → storefront: "EC-10822-merge", backend: "EC-10822-merge"
  //

  const SF = "/Users/x/seo/elements-storefront";
  const BE = "/Users/x/seo/elements-backend";

  void it("EC-10823/10824 merge from EC-10822's branch via depends_on", async () => {
    // New prioritizer output (after restart with guidance)
    const layers: GroupedLayer[] = [
      {
        group: [
          {
            key: "EC-10823",
            repos: [{ repoPath: SF, branch: "ec-10823-update-filters-for-tab-context" }],
          },
          {
            key: "EC-10824",
            repos: [{ repoPath: SF, branch: "ec-10824-handle-empty-states-for-team-ta" }],
          },
        ],
        relation: "same-epic",
        verification: {
          required: true,
          reason: "Filter updates and empty states are visible UI changes",
        },
        dependsOn: "EC-10822",
      },
    ];

    // Persisted group states from the previous run's completed groups
    const initialGroupStates: GroupStates = new Map([
      [
        "EC-10819",
        {
          branches: new Map([[SF, "EC-10819-merge-add-team-tabs"]]),
          prUrls: new Map([[SF, "https://github.com/envato/elements-storefront/pull/100"]]),
        },
      ],
      [
        "EC-10821",
        {
          branches: new Map([[SF, "EC-10821-merge-add-tab-state"]]),
          prUrls: new Map([[SF, "https://github.com/envato/elements-storefront/pull/101"]]),
        },
      ],
      [
        "EC-10822",
        {
          branches: new Map([
            [SF, "EC-10822-merge"],
            [BE, "EC-10822-merge"],
          ]),
          prUrls: new Map([
            [SF, "https://github.com/envato/elements-storefront/pull/21178"],
            [BE, "https://github.com/envato/elements-backend/pull/11798"],
          ]),
        },
      ],
    ]);

    // Only EC-10823 and EC-10824 are unprocessed
    const unprocessed = new Set(["EC-10823", "EC-10824"]);

    const calls: Array<{ prompt: string; taskName: string }> = [];
    const runner = {
      run: async (prompt: string, opts: { taskName: string }) => {
        calls.push({ prompt, taskName: opts.taskName });
        if (opts.taskName.includes("forge")) return { code: 0, stdout: "" };
        if (opts.taskName.includes("merge"))
          return { code: 0, stdout: "EC-10823-merge-update-filters" };
        if (opts.taskName.includes("pr")) {
          return {
            code: 0,
            stdout: JSON.stringify({
              pr_url: "https://github.com/envato/elements-storefront/pull/21200",
              status: "success",
            }),
          };
        }
        return { code: 0, stdout: "ok" };
      },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;

    const { logs, log } = collectLogs();
    const result = await processLayers(
      layers,
      unprocessed,
      new Set(),
      new Set(),
      [SF, BE],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
      initialGroupStates,
    );

    // Both tickets processed
    assert.equal(result.succeeded, 2);
    assert.equal(result.failed, 0);

    // Merge should branch from EC-10822-merge (the parent group's storefront branch)
    const mergeCall = calls.find((c) => c.taskName.includes("merge"));
    assert.ok(mergeCall, "merge call must exist");
    assert.ok(
      mergeCall.prompt.includes('from "EC-10822-merge"'),
      `should merge from EC-10822-merge, got: ${mergeCall.prompt}`,
    );

    // PR should be stacked on EC-10822-merge
    const prCall = calls.find((c) => c.taskName.includes("pr"));
    assert.ok(prCall, "PR call must exist");
    assert.ok(
      prCall.prompt.includes("EC-10822-merge"),
      "PR should reference EC-10822-merge as base branch",
    );
    assert.ok(prCall.prompt.includes("stacked PR"), "PR should be marked as stacked");
    assert.ok(
      prCall.prompt.includes("https://github.com/envato/elements-storefront/pull/21178"),
      "PR should reference EC-10822's PR URL",
    );

    // Log should show the dependency
    assert.ok(logs.some((l) => l.includes("→EC-10822")));
  });

  void it("resolves depends_on through ticketToGroup when referencing non-primary", async () => {
    // What if the prioritizer produced depends_on: "EC-10820" instead of "EC-10821"?
    // EC-10820 is in EC-10821's group. ticketToGroup should resolve it.
    const layers: GroupedLayer[] = [
      {
        group: [
          { key: "EC-10821", repos: [{ repoPath: SF, branch: "ec-10821-state" }] },
          { key: "EC-10820", repos: [{ repoPath: SF, branch: "ec-10820-display" }] },
        ],
        relation: "same-epic",
        verification: { required: false, reason: "test" },
        dependsOn: null,
      },
      {
        group: [{ key: "EC-10823", repos: [{ repoPath: SF, branch: "ec-10823-filters" }] }],
        relation: null,
        verification: { required: false, reason: "test" },
        dependsOn: "EC-10820", // references non-primary ticket in EC-10821's group
      },
    ];

    const calls: Array<{ prompt: string; taskName: string }> = [];
    const runner = {
      run: async (prompt: string, opts: { taskName: string }) => {
        calls.push({ prompt, taskName: opts.taskName });
        if (opts.taskName.includes("forge")) return { code: 0, stdout: "" };
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-10821"))
          return { code: 0, stdout: "EC-10821-merge-state" };
        if (opts.taskName.includes("merge") && opts.taskName.includes("EC-10823"))
          return { code: 0, stdout: "EC-10823-merge-filters" };
        return { code: 0, stdout: "ok" };
      },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;

    const { log } = collectLogs();
    const result = await processLayers(
      layers,
      new Set(["EC-10821", "EC-10820", "EC-10823"]),
      new Set(),
      new Set(),
      [SF],
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(result.succeeded, 3);

    // EC-10823's merge should branch from EC-10821-merge-state
    // (EC-10820 resolved to EC-10821's group via ticketToGroup)
    const ec10823Merge = calls.find(
      (c) => c.taskName.includes("merge") && c.taskName.includes("EC-10823"),
    );
    assert.ok(ec10823Merge);
    assert.ok(
      ec10823Merge.prompt.includes('from "EC-10821-merge-state"'),
      `EC-10823 should merge from EC-10821's branch, got: ${ec10823Merge.prompt}`,
    );
  });
});
