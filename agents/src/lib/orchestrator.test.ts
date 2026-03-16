import { describe, it } from "node:test";
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
  } as unknown as JiraClient;
}

function makeTracker(processed: string[] = []): ProcessedTracker {
  const marked: string[] = [];
  return {
    load: () => new Set(processed),
    mark: (key: string) => marked.push(key),
  } as unknown as ProcessedTracker;
}

function makeRunner(): ClaudeRunner {
  return {
    run: async (_prompt: string, opts: { taskName: string }) => {
      if (opts.taskName.includes("forge")) return { code: 0, stdout: '{"worktree_path": "/wt/t"}' };
      return { code: 0, stdout: "branch-name" };
    },
    writeLog: () => "/fake",
  } as unknown as ClaudeRunner;
}

function makeDevServers(): DevServerManager {
  return {
    devUrl: "http://localhost:3000",
    startAll: async () => {},
    stopAll: () => {},
    restartOnBranch: async () => {},
  } as unknown as DevServerManager;
}

function makeDeps(
  overrides: Partial<OrchestratorDeps> = {},
): OrchestratorDeps & { logs: string[] } {
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
  });
});

// ─── prioritize ──────────────────────────────────────────────────────────────

void describe("GSDOrchestrator.prioritize", () => {
  void it("passes previous result as guidance and preserves saved groupStates", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));

    // Pre-save state from a previous run
    runState.save({
      layers: [
        {
          group: [{ key: "EC-1", repos: [{ repoPath: "/repo", branch: "ec-1-fix" }] }],
          relation: null,
          verification: { required: false, reason: "test" },
          dependsOn: null,
        },
      ],
      skipped: [],
      excluded: [],
    });
    runState.updateGroupStates(
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

    let capturedPrompt = "";
    const runner = {
      run: async (prompt: string) => {
        capturedPrompt = prompt;
        return {
          code: 0,
          stdout: JSON.stringify({
            layers: [
              {
                group: [
                  { key: "EC-1", repos: [{ repo: "my-repo", branch: "ec-1-fix" }] },
                  { key: "EC-2", repos: [{ repo: "my-repo", branch: "ec-2-new" }] },
                ],
                relation: null,
                verification: { required: false, reason: "test" },
                dependsOn: null,
              },
            ],
          }),
        };
      },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;

    const deps = makeDeps({ runState, runner, baseRepos: ["/abs/my-repo"] });
    const orch = new GSDOrchestrator(deps);

    const result = await orch.prioritize(["EC-1", "EC-2"]);

    assert.ok(capturedPrompt.includes("PREVIOUS RUN GUIDANCE"));
    assert.ok(result.initialGroupStates);
    assert.equal(result.initialGroupStates.get("EC-1")?.branches.get("/repo"), "ec-1-merge");
  });

  void it("runs fresh prioritization when no saved state exists", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    let capturedPrompt = "";
    const runner = {
      run: async (prompt: string) => {
        capturedPrompt = prompt;
        return {
          code: 0,
          stdout: JSON.stringify({
            layers: [
              {
                group: [{ key: "EC-1", repos: [{ repo: "my-repo", branch: "ec-1-fix" }] }],
                relation: null,
                verification: { required: false, reason: "test" },
                dependsOn: null,
              },
            ],
          }),
        };
      },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;

    const deps = makeDeps({
      runState: new RunState(join(tmpDir, "run-state.json")),
      runner,
      baseRepos: ["/abs/my-repo"],
    });
    const orch = new GSDOrchestrator(deps);
    const result = await orch.prioritize(["EC-1"]);

    assert.ok(!capturedPrompt.includes("PREVIOUS RUN GUIDANCE"));
    assert.equal(result.initialGroupStates, undefined);
  });
});

// ─── summarize ───────────────────────────────────────────────────────────────

void describe("GSDOrchestrator.summarize", () => {
  void it("clears run state when no failures", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));
    runState.save({
      layers: [
        {
          group: [],
          relation: null,
          verification: { required: false, reason: "" },
          dependsOn: null,
        },
      ],
      skipped: [],
      excluded: [],
    });

    const deps = makeDeps({ runState });
    const orch = new GSDOrchestrator(deps);
    orch.summarize(1, 0, 0);
    assert.equal(runState.load(), null);
  });

  void it("preserves run state when there are failures", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));
    runState.save({
      layers: [
        {
          group: [],
          relation: null,
          verification: { required: false, reason: "" },
          dependsOn: null,
        },
      ],
      skipped: [],
      excluded: [],
    });

    const deps = makeDeps({ runState });
    const orch = new GSDOrchestrator(deps);
    orch.summarize(1, 0, 2);
    assert.ok(runState.load());
  });
});

// ─── run (end-to-end) ────────────────────────────────────────────────────────

void describe("GSDOrchestrator.run", () => {
  void it("exits early when discover returns null", async () => {
    const deps = makeDeps({ jira: makeJira(null) });
    const orch = new GSDOrchestrator(deps);
    await orch.run();
    assert.ok(!deps.logs.some((l) => l.includes("PRIORITIZ")));
  });
});
