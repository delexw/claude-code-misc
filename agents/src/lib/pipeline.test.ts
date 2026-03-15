import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeAndVerify, processLayers, type LayerState } from "./pipeline.js";
import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { DevServerManager } from "./dev-servers.js";
import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";
import type { ForgeResult } from "./prompts.js";
import type { GroupedLayer } from "./prioritizer.js";

const NO_BASE: LayerState = { branches: new Map(), prUrls: new Map() };

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
      true,
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
      true,
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
      true,
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
      true,
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
      true,
      NO_BASE,
      runner,
      makeDevServers(),
      makeJira(),
      tracker,
      log,
    );

    assert.deepEqual(tracker.marked, ["EC-1", "EC-2"]);
  });

  void it("moves tickets to In Progress via jira", async () => {
    const movedTickets: string[] = [];
    const jira = {
      ticketUrl: () => "",
      moveTicket: async (key: string) => {
        movedTickets.push(key);
        return true;
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
      true,
      NO_BASE,
      runner,
      makeDevServers(),
      jira,
      makeTracker(),
      log,
    );

    assert.deepEqual(movedTickets, ["EC-1", "EC-2"]);
  });

  void it("skips verify when hasFrontend is false", async () => {
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
      false,
      NO_BASE,
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    // commit + merge + PR = 3 calls (no verify)
    assert.equal(runCallCount, 3);
  });

  void it("calls restartOnBranch when hasFrontend and merge succeeds", async () => {
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
      true,
      NO_BASE,
      runner,
      devServers,
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(restartedBranch, "my-merge-branch");
  });

  void it("does not restart servers when hasFrontend is false", async () => {
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
      false,
      NO_BASE,
      runner,
      devServers,
      makeJira(),
      makeTracker(),
      log,
    );

    assert.equal(restarted, false);
  });

  void it("logs warning when jira moveTicket fails", async () => {
    const jira = {
      ticketUrl: () => "",
      moveTicket: async () => false,
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
      true,
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
      true,
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
      true,
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
        hasFrontend: false,
      },
      {
        group: [{ key: "EC-2", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        hasFrontend: false,
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
        hasFrontend: false,
      },
      {
        group: [{ key: "EC-99", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
        relation: null,
        hasFrontend: false,
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
        hasFrontend: false,
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
        hasFrontend: false,
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
        hasFrontend: false,
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
        hasFrontend: false,
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

  void it("threads baseBranch and PR URL from layer 0 into layer 1 (stacked chain)", async () => {
    const layers: GroupedLayer[] = [
      {
        group: [{ key: "EC-10", repos: [{ repoPath: "/repo", branch: "ec-10-auth" }] }],
        relation: null,
        hasFrontend: false,
      },
      {
        group: [{ key: "EC-20", repos: [{ repoPath: "/repo", branch: "ec-20-rate-limit" }] }],
        relation: null,
        hasFrontend: false,
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
    const layer0Pr = calls.find(
      (c) => c.taskName.includes("pr") && c.taskName.includes("EC-10"),
    );
    assert.ok(layer0Pr, "layer 0 PR call must exist");
    assert.ok(
      !layer0Pr.prompt.includes("stacked PR"),
      "layer 0 PR should NOT be a stacked PR",
    );
    assert.ok(
      layer0Pr.prompt.includes('"main"'),
      "layer 0 PR base branch should be main",
    );

    // --- Layer 1: PR should reference layer 0's PR URL ---
    const layer1Pr = calls.find(
      (c) => c.taskName.includes("pr") && c.taskName.includes("EC-20"),
    );
    assert.ok(layer1Pr, "layer 1 PR call must exist");
    assert.ok(
      layer1Pr.prompt.includes("stacked PR"),
      "layer 1 PR should be marked as stacked",
    );
    assert.ok(
      layer1Pr.prompt.includes("ec-10-merge"),
      "layer 1 PR should reference ec-10-merge as base branch",
    );
    assert.ok(
      layer1Pr.prompt.includes("https://github.com/org/repo/pull/42"),
      "layer 1 PR should include layer 0's PR URL in dependency note",
    );
  });
});
