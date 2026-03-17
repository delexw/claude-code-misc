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
  const baseRepos = overrides.baseRepos ?? [];
  const runner = makeRunner();
  const devServers = makeDevServers();
  const runState = overrides.runState ?? new RunState(join(tmpDir, "run-state.json"));
  return {
    discovery: new SprintDiscovery(jira, runState, baseRepos),
    prioritizer: overrides.prioritizer ?? new Prioritizer({ runner, scriptDir: tmpDir, log }),
    pipeline: overrides.pipeline ?? new Pipeline({ runner, devServers, jira, runState, log }),
    jira,
    runState,
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

    const result = await orch.prioritize(["EC-1", "EC-2"], "Sprint 1");

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
    const result = await orch.prioritize(["EC-1"], "Sprint 1");

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

  void it("preserves cross-sprint state when PRs are not yet merged", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));

    // Save state from Sprint 1 with a PR in flight
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
      }),
      "Sprint 1",
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

    // Sprint 2: EC-2 depends on EC-1's branch
    const jira = makeJira("Sprint 2", [{ key: "EC-2", status: "To Do" }]);

    const prioritizer = {
      prioritize: async () => ({
        resolved: {
          layers: [
            {
              group: [{ key: "EC-2", repos: [{ repoPath: "/abs/my-repo", branch: "ec-2-new" }] }],
              relation: null,
              verification: { required: false, reason: "test" },
              dependsOn: null,
            },
          ],
          skipped: [],
          excluded: [],
        },
        rawJson: "{}",
      }),
    } as unknown as Prioritizer;

    const pipeline = {
      processLayers: async () => ({ succeeded: 1, failed: 0 }),
    } as unknown as Pipeline;

    const deps = makeDeps({ jira, runState, prioritizer, pipeline, baseRepos: ["/abs/my-repo"] });
    const orch = new GSDOrchestrator(deps);
    await orch.run();

    // EC-1 PR not merged — state preserved across sprint boundary
    assert.ok(!deps.logs.some((l) => l.includes("PRUNED")));
    assert.equal(runState.completedTicketKeys().has("EC-1"), true);
  });

  void it("re-includes in-flight tickets from previous run on restart", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));

    // Simulate previous run: EC-1 was prioritized and forged (moved to In Progress)
    // but never completed (crash before commit+PR).
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
      }),
    );

    // EC-1 is "In Progress" (forge moved it), EC-2 is "To Do"
    // EC-1 not completed — crash happened before commit+PR
    const jira = makeJira("Sprint 1", [
      { key: "EC-1", status: "In Progress" },
      { key: "EC-2", status: "To Do" },
    ]);
    // No extra completed keys — RunState handles this via completedTicketKeys() // nothing marked as processed

    // Capture what tickets are passed to prioritize
    const prioritizer = {
      prioritize: async (_keys: string[]) => {
        return {
          resolved: {
            layers: [
              {
                group: [
                  { key: "EC-1", repos: [{ repoPath: "/abs/my-repo", branch: "ec-1-fix" }] },
                  { key: "EC-2", repos: [{ repoPath: "/abs/my-repo", branch: "ec-2-new" }] },
                ],
                relation: null,
                verification: { required: false, reason: "test" },
                dependsOn: null,
              },
            ],
            skipped: [],
            excluded: [],
          },
          rawJson: "{}",
        };
      },
    } as unknown as Prioritizer;

    // Pipeline mock that tracks what unprocessed keys it receives
    let capturedUnprocessed: Set<string> | null = null;
    const pipeline = {
      processLayers: async (
        _layers: unknown,
        unprocessed: Set<string>,
      ) => {
        capturedUnprocessed = new Set(unprocessed);
        return { succeeded: 2, failed: 0 };
      },
    } as unknown as Pipeline;

    const deps = makeDeps({
      jira,
      runState,
      prioritizer,
      pipeline,
      baseRepos: ["/abs/my-repo"],
    });
    const orch = new GSDOrchestrator(deps);
    await orch.run();

    // EC-1 should be re-included in unprocessed despite being "In Progress"
    assert.notEqual(capturedUnprocessed, null, "processLayers should have been called");
    assert.ok(capturedUnprocessed!.has("EC-1"), "EC-1 should be re-included as unprocessed");
    assert.ok(capturedUnprocessed!.has("EC-2"), "EC-2 should be unprocessed normally");
    assert.ok(deps.logs.some((l) => l.includes("RESUME: EC-1")));
  });

  void it("does not resume tickets from completed groups (has PRs)", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    const runState = new RunState(join(tmpDir, "run-state.json"));

    // EC-1 was fully completed in a previous run (has PR URLs)
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
      }),
    );
    runState.updateGroupStates(
      new Map([
        [
          "EC-1",
          {
            branches: new Map([["/repo", "ec-1-merge"]]),
            prUrls: new Map([["/repo", "https://github.com/org/repo/pull/42"]]),
          },
        ],
      ]),
    );

    // EC-1 is "In Review", tracker reset (new day — empty processed set)
    const jira = makeJira("Sprint 1", [
      { key: "EC-1", status: "In Review" },
      { key: "EC-2", status: "To Do" },
    ]);
    // No extra completed keys — RunState handles this via completedTicketKeys()

    let capturedUnprocessed: Set<string> | null = null;
    const prioritizer = {
      prioritize: async () => ({
        resolved: {
          layers: [
            {
              group: [{ key: "EC-2", repos: [{ repoPath: "/abs/my-repo", branch: "ec-2-new" }] }],
              relation: null,
              verification: { required: false, reason: "test" },
              dependsOn: null,
            },
          ],
          skipped: [],
          excluded: [],
        },
        rawJson: "{}",
      }),
    } as unknown as Prioritizer;

    const pipeline = {
      processLayers: async (_layers: unknown, unprocessed: Set<string>) => {
        capturedUnprocessed = new Set(unprocessed);
        return { succeeded: 1, failed: 0 };
      },
    } as unknown as Pipeline;

    const deps = makeDeps({
      jira,
      runState,
      prioritizer,
      pipeline,
      baseRepos: ["/abs/my-repo"],
    });
    const orch = new GSDOrchestrator(deps);
    await orch.run();

    // EC-1 should NOT be re-included — it already has PRs
    assert.notEqual(capturedUnprocessed, null);
    assert.ok(!capturedUnprocessed!.has("EC-1"), "EC-1 should not be resumed — already completed");
    assert.ok(capturedUnprocessed!.has("EC-2"), "EC-2 should be unprocessed normally");
    assert.ok(deps.logs.some((l) => l.includes("SKIP RESUME: EC-1")));
  });
});
