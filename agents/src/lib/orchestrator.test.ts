import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GSDOrchestrator, type OrchestratorDeps } from "./orchestrator.js";
import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { DevServerManager } from "./dev-servers.js";
import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";
import { RunState } from "./run-state.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function collectLogs(): { logs: string[]; log: LogFn } {
  const logs: string[] = [];
  return { logs, log: (msg: string) => logs.push(msg) };
}

function makeJira(
  sprint: string | null = "Sprint 1",
  tickets: Array<{ key: string; status: string }> = [],
): JiraClient {
  return {
    getActiveSprint: async () => sprint,
    fetchSprintTickets: async () => tickets,
    ticketUrl: (key: string) => `https://jira/${key}`,
    moveTicket: async () => true,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
  } as unknown as JiraClient;
}

function makeTracker(processed: string[] = []): ProcessedTracker {
  const marked: string[] = [];
  return {
    load: () => new Set(processed),
    mark: (key: string) => marked.push(key),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
  } as unknown as ProcessedTracker;
}

function makeRunner(): ClaudeRunner {
  return {
    run: async (_prompt: string, opts: { taskName: string }) => {
      if (opts.taskName.includes("forge")) {
        return { code: 0, stdout: '{"worktree_path": "/wt/t"}' };
      }
      return { code: 0, stdout: "branch-name" };
    },
    writeLog: () => "/fake",
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
  } as unknown as ClaudeRunner;
}

function makeDevServers(): DevServerManager {
  return {
    devUrl: "http://localhost:3000",
    startAll: async () => {},
    stopAll: () => {},
    restartOnBranch: async () => {},
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
  } as unknown as DevServerManager;
}

function makeDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps & { logs: string[] } {
  const { logs, log } = collectLogs();
  const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
  return {
    jira: makeJira(),
    tracker: makeTracker(),
    runState: new RunState(join(tmpDir, "run-state.json")),
    runner: makeRunner(),
    devServers: makeDevServers(),
    baseRepos: [],
    scriptDir: tmpDir,
    log,
    logs,
    ...overrides,
  };
}

// ─── discover ─────────────────────────────────────────────────────────────────

void describe("GSDOrchestrator.discover", () => {
  void it("returns null when no active sprint", async () => {
    const deps = makeDeps({ jira: makeJira(null) });
    const orch = new GSDOrchestrator(deps);

    assert.equal(await orch.discover(), null);
  });

  void it("returns null when sprint has no tickets", async () => {
    const deps = makeDeps({ jira: makeJira("Sprint 1", []) });
    const orch = new GSDOrchestrator(deps);

    assert.equal(await orch.discover(), null);
  });

  void it("returns null when all pending tickets are already processed", async () => {
    const deps = makeDeps({
      jira: makeJira("Sprint 1", [
        { key: "EC-1", status: "To Do" },
        { key: "EC-2", status: "In Progress" },
      ]),
      tracker: makeTracker(["EC-1"]),
    });
    const orch = new GSDOrchestrator(deps);

    assert.equal(await orch.discover(), null);
    assert.ok(deps.logs.some((l) => l.includes("No unprocessed")));
  });

  void it("returns null when all tickets are context (no pending)", async () => {
    const deps = makeDeps({
      jira: makeJira("Sprint 1", [
        { key: "EC-1", status: "In Progress" },
        { key: "EC-2", status: "Done" },
      ]),
    });
    const orch = new GSDOrchestrator(deps);

    assert.equal(await orch.discover(), null);
  });

  void it("returns discovery result with unprocessed tickets", async () => {
    const deps = makeDeps({
      jira: makeJira("Sprint 1", [
        { key: "EC-1", status: "To Do" },
        { key: "EC-2", status: "Backlog" },
        { key: "EC-3", status: "In Progress" },
      ]),
    });
    const orch = new GSDOrchestrator(deps);

    const result = await orch.discover();
    assert.ok(result);
    assert.deepEqual(result.allKeys, ["EC-1", "EC-2", "EC-3"]);
    assert.deepEqual(result.unprocessed, ["EC-1", "EC-2"]);
    assert.equal(result.skippedCount, 0);
  });

  void it("separates processed from unprocessed and counts skips", async () => {
    const deps = makeDeps({
      jira: makeJira("Sprint 1", [
        { key: "EC-1", status: "To Do" },
        { key: "EC-2", status: "To Do" },
        { key: "EC-3", status: "Backlog" },
      ]),
      tracker: makeTracker(["EC-1"]),
    });
    const orch = new GSDOrchestrator(deps);

    const result = await orch.discover();
    assert.ok(result);
    assert.deepEqual(result.unprocessed, ["EC-2", "EC-3"]);
    assert.equal(result.skippedCount, 1);
    assert.ok(deps.logs.some((l) => l.includes("SKIP: EC-1")));
  });

  void it("includes all ticket keys (not just pending) in allKeys", async () => {
    const deps = makeDeps({
      jira: makeJira("Sprint 1", [
        { key: "EC-1", status: "To Do" },
        { key: "EC-2", status: "In Progress" },
        { key: "EC-3", status: "Done" },
      ]),
    });
    const orch = new GSDOrchestrator(deps);

    const result = await orch.discover();
    assert.ok(result);
    assert.deepEqual(result.allKeys, ["EC-1", "EC-2", "EC-3"]);
    assert.deepEqual(result.unprocessed, ["EC-1"]);
  });
});

// ─── prioritize ──────────────────────────────────────────────────────────────

void describe("GSDOrchestrator.prioritize", () => {
  void it("resumes from saved state when fingerprint matches", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));

    // Pre-save state
    runState.savePrioritizerResult(
      {
        layers: [{
          group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
          relation: null,
          verification: { required: false, reason: "test" },
        }],
        skipped: [],
        excluded: [{ key: "EC-2", reason: "Done" }],
      },
      ["EC-1", "EC-2"],
    );
    runState.updateLayerState({
      branches: new Map([["/repo", "ec-1-merge"]]),
      prUrls: new Map([["/repo", "https://pr/1"]]),
    });

    const deps = makeDeps({ runState, baseRepos: [] });
    const orch = new GSDOrchestrator(deps);

    const result = await orch.prioritize(["EC-1", "EC-2"], new Set());

    assert.ok(result.initialLayerState);
    assert.equal(result.initialLayerState.branches.get("/repo"), "ec-1-merge");
    assert.equal(result.layers.length, 1);
    assert.equal(result.excluded.length, 1);
    assert.ok(deps.logs.some((l) => l.includes("RESUMING")));
  });

  void it("discards saved state when fingerprint does not match", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));

    // Save state for different ticket set
    runState.savePrioritizerResult(
      {
        layers: [{
          group: [{ key: "EC-1", repos: [] }],
          relation: null,
          verification: { required: false, reason: "test" },
        }],
        skipped: [],
        excluded: [],
      },
      ["EC-1"],
    );

    // Runner that returns a valid prioritizer result for the new ticket set
    const runner = {
      run: async () => ({
        code: 0,
        stdout: JSON.stringify({
          layers: [{
            group: [
              { key: "EC-1", repos: [{ repo: "my-repo", branch: "ec-1-fix" }] },
              { key: "EC-2", repos: [{ repo: "my-repo", branch: "ec-2-fix" }] },
            ],
            relation: null,
            verification: { required: false, reason: "test" },
          }],
          skipped: [],
          excluded: [],
        }),
      }),
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;

    const deps = makeDeps({ runState, runner, baseRepos: ["/abs/my-repo"] });
    const orch = new GSDOrchestrator(deps);

    const result = await orch.prioritize(["EC-1", "EC-2"], new Set());

    assert.equal(result.initialLayerState, undefined);
    assert.equal(result.layers[0].group.length, 2);
    assert.ok(!deps.logs.some((l) => l.includes("RESUMING")));
  });
});

// ─── summarize ───────────────────────────────────────────────────────────────

void describe("GSDOrchestrator.summarize", () => {
  void it("logs summary line", () => {
    const deps = makeDeps();
    const orch = new GSDOrchestrator(deps);

    orch.summarize(3, 1, 0);

    assert.ok(deps.logs.some((l) => l.includes("processed=3") && l.includes("skipped=1") && l.includes("failed=0")));
  });

  void it("clears run state when no failures", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));
    runState.savePrioritizerResult(
      { layers: [{ group: [], relation: null, verification: { required: false, reason: "" } }], skipped: [], excluded: [] },
      ["EC-1"],
    );

    const deps = makeDeps({ runState });
    const orch = new GSDOrchestrator(deps);
    orch.summarize(1, 0, 0);

    // State should be cleared — load returns null
    assert.equal(runState.load(["EC-1"]), null);
  });

  void it("preserves run state when there are failures", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));
    runState.savePrioritizerResult(
      { layers: [{ group: [], relation: null, verification: { required: false, reason: "" } }], skipped: [], excluded: [] },
      ["EC-1"],
    );

    const deps = makeDeps({ runState });
    const orch = new GSDOrchestrator(deps);
    orch.summarize(1, 0, 2);

    // State should still exist
    assert.ok(runState.load(["EC-1"]));
  });
});

// ─── run (end-to-end) ────────────────────────────────────────────────────────

void describe("GSDOrchestrator.run", () => {
  void it("exits early when discover returns null", async () => {
    const deps = makeDeps({ jira: makeJira(null) });
    const orch = new GSDOrchestrator(deps);

    await orch.run(); // should not throw
    assert.ok(!deps.logs.some((l) => l.includes("PRIORITIZ")));
  });

  void it("runs full workflow with resumed state: discover → resume → process → summarize", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));

    // Pre-save prioritizer result so we skip the Claude prioritizer call
    runState.savePrioritizerResult(
      {
        layers: [{
          group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
          relation: null,
          verification: { required: false, reason: "test" },
        }],
        skipped: [],
        excluded: [],
      },
      ["EC-1"],
    );

    const runner = {
      run: async (_prompt: string, opts: { taskName: string }) => {
        if (opts.taskName.includes("forge")) {
          return { code: 0, stdout: '{"worktree_path": "/wt/ec-1"}' };
        }
        return { code: 0, stdout: "branch-name" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;

    const deps = makeDeps({
      jira: makeJira("Sprint 1", [{ key: "EC-1", status: "To Do" }]),
      runState,
      runner,
      baseRepos: [],
      scriptDir: tmpDir,
    });
    const orch = new GSDOrchestrator(deps);

    await orch.run();

    assert.ok(deps.logs.some((l) => l.includes("Found 1 ticket")));
    assert.ok(deps.logs.some((l) => l.includes("RESUMING")));
    assert.ok(deps.logs.some((l) => l.includes("Layer 0")));
    assert.ok(deps.logs.some((l) => l.includes("Summary")));
  });
});
