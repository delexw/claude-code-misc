import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GSDOrchestrator, type OrchestratorDeps } from "./orchestrator.js";
import { SprintDiscovery } from "./discovery.js";
import { Prioritizer } from "./prioritizer.js";
import { Pipeline } from "./pipeline.js";
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
    getParentKey: async () => null,
    hasUnfinishedSubtasks: async () => true,
    promoteToReview: async () => {},
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
  const jira = overrides.jira ?? makeJira();
  const tracker = overrides.tracker ?? makeTracker();
  const baseRepos = overrides.baseRepos ?? [];
  const runner = makeRunner();
  const devServers = makeDevServers();
  return {
    discovery: new SprintDiscovery(jira, tracker, baseRepos),
    prioritizer: overrides.prioritizer ?? new Prioritizer({ runner, scriptDir: tmpDir, log }),
    pipeline: overrides.pipeline ?? new Pipeline({ runner, devServers, jira, tracker, log }),
    jira,
    tracker,
    runState: new RunState(join(tmpDir, "run-state.json")),
    baseRepos,
    log,
    logs,
    ...overrides,
  };
}

// ─── prioritize ──────────────────────────────────────────────────────────────

void describe("GSDOrchestrator.prioritize", () => {
  void it("passes previous result as guidance and preserves saved groupStates", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));

    // Pre-save state from a previous run (raw LLM JSON with original field names)
    runState.save(
      JSON.stringify({
        layers: [
          {
            group: [{ key: "EC-1", repos: [{ repo: "my-repo", branch: "ec-1-fix" }] }],
            relation: null,
            verification: { required: false, reason: "test" },
            depends_on: null,
          },
        ],
        skipped: [],
        excluded: [],
      }),
    );
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

    const { log } = collectLogs();
    const deps = makeDeps({
      runState,
      prioritizer: new Prioritizer({ runner, scriptDir: tmpDir, log }),
      baseRepos: ["/abs/my-repo"],
    });
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

    const { log } = collectLogs();
    const deps = makeDeps({
      runState: new RunState(join(tmpDir, "run-state.json")),
      prioritizer: new Prioritizer({ runner, scriptDir: tmpDir, log }),
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
  void it("preserves all state on success for next-run guidance", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));
    runState.save(JSON.stringify({ layers: [{ group: [{ key: "EC-1", repos: [] }] }] }));
    runState.updateGroupStates(
      new Map([["EC-1", { branches: new Map([["/r", "b"]]), prUrls: new Map() }]]),
    );

    const deps = makeDeps({ runState });
    const orch = new GSDOrchestrator(deps);
    orch.summarize(1, 0, 0);

    const loaded = runState.load();
    assert.ok(loaded, "state should be preserved");
    assert.equal(loaded.groupStates.size, 1, "groupStates preserved for merge chain");
    assert.ok(loaded.prioritizerRawJson, "raw JSON preserved for guidance");
  });

  void it("preserves run state when there are failures", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));
    runState.save(JSON.stringify({ layers: [{ group: [] }] }));

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
