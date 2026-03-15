import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeAndVerify, processLayers } from "./pipeline.js";
import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { DevServerManager } from "./dev-servers.js";
import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";
import type { ForgeResult } from "./prompts.js";
import type { GroupedLayer } from "./prioritizer.js";

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
    { ticketKey: "EC-1", status: "success", worktreePath: "/wt/ec-1" },
    { ticketKey: "EC-2", status: "success", worktreePath: "/wt/ec-2" },
  ];

  void it("returns all succeeded when merge, verify, and PR pass", async () => {
    const runner = makeRunner([
      { code: 0, stdout: "EC-1-merge-branch" }, // merge
      { code: 0, stdout: "verify ok" }, // verify
      { code: 0, stdout: "pr created" }, // PR
    ]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      successForges,
      ["EC-1", "EC-2"],
      ["/repo"],
      true,
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
    const forges: ForgeResult[] = [{ ticketKey: "EC-1", status: "failed", worktreePath: "" }];
    const runner = makeRunner([]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      forges,
      ["EC-1"],
      ["/repo"],
      true,
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
      { code: 1, stdout: "" }, // merge fails
    ]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      successForges,
      ["EC-1", "EC-2"],
      ["/repo"],
      true,
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
      { ticketKey: "EC-1", status: "success", worktreePath: "/wt/ec-1" },
      { ticketKey: "EC-2", status: "failed", worktreePath: "" },
    ];
    const runner = makeRunner([
      { code: 0, stdout: "merge-branch" },
      { code: 0, stdout: "verify ok" },
      { code: 0, stdout: "pr ok" },
    ]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      mixed,
      ["EC-1", "EC-2"],
      ["/repo"],
      true,
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
      { code: 0, stdout: "branch" },
      { code: 0, stdout: "ok" },
      { code: 0, stdout: "ok" },
    ]);
    const tracker = makeTracker();
    const { log } = collectLogs();

    await mergeAndVerify(
      successForges,
      ["EC-1", "EC-2"],
      ["/repo"],
      true,
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
      { code: 0, stdout: "branch" },
      { code: 0, stdout: "ok" },
      { code: 0, stdout: "ok" },
    ]);
    const { log } = collectLogs();

    await mergeAndVerify(
      successForges,
      ["EC-1", "EC-2"],
      ["/repo"],
      true,
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
      ["EC-1"],
      ["/repo"],
      false,
      runner,
      makeDevServers(),
      makeJira(),
      makeTracker(),
      log,
    );

    // merge + PR = 2 calls (no verify)
    assert.equal(runCallCount, 2);
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
      { code: 0, stdout: "my-merge-branch" },
      { code: 0, stdout: "ok" },
      { code: 0, stdout: "ok" },
    ]);
    const { log } = collectLogs();

    await mergeAndVerify(
      [successForges[0]],
      ["EC-1"],
      ["/repo"],
      true,
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
      { code: 0, stdout: "branch" },
      { code: 0, stdout: "ok" },
    ]);
    const { log } = collectLogs();

    await mergeAndVerify(
      [successForges[0]],
      ["EC-1"],
      ["/repo"],
      false,
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
      { code: 0, stdout: "branch" },
      { code: 0, stdout: "ok" },
      { code: 0, stdout: "ok" },
    ]);
    const { logs, log } = collectLogs();

    await mergeAndVerify(
      [successForges[0]],
      ["EC-1"],
      ["/repo"],
      true,
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
      { code: 0, stdout: "branch" },
      { code: 1, stdout: "verify failed" }, // verify fails
      { code: 0, stdout: "pr ok" },
    ]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      [successForges[0]],
      ["EC-1"],
      ["/repo"],
      true,
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
      { code: 0, stdout: "branch" },
      { code: 0, stdout: "ok" },
      { code: 1, stdout: "pr failed" }, // PR fails
    ]);
    const { log } = collectLogs();

    const result = await mergeAndVerify(
      [successForges[0]],
      ["EC-1"],
      ["/repo"],
      true,
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
      { group: ["EC-1"], relation: null, hasFrontend: false },
      { group: ["EC-2"], relation: null, hasFrontend: false },
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
      { group: ["EC-1"], relation: null, hasFrontend: false },
      { group: ["EC-99"], relation: null, hasFrontend: false }, // not in unprocessed
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
      { group: ["EC-1", "EC-2", "EC-3"], relation: null, hasFrontend: false },
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
    const layers: GroupedLayer[] = [{ group: ["EC-1"], relation: null, hasFrontend: false }];
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
    const layers: GroupedLayer[] = [{ group: ["EC-1"], relation: "same-epic", hasFrontend: false }];
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
    const layers: GroupedLayer[] = [{ group: ["EC-1"], relation: null, hasFrontend: false }];
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
});
