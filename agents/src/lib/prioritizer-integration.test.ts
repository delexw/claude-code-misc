import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prioritizeTickets } from "./prioritizer.js";
import type { ClaudeRunner, LogFn } from "./claude-runner.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REPOS = ["/repo-a", "/repo-b"];

function collectLogs(): { logs: string[]; log: LogFn } {
  const logs: string[] = [];
  return { logs, log: (msg: string) => logs.push(msg) };
}

function makeRunner(response: { code: number; stdout: string }): ClaudeRunner {
  return {
    run: async () => response,
    writeLog: () => "/fake/log",
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
  } as unknown as ClaudeRunner;
}

function keys(group: Array<{ key: string }>): string[] {
  return group.map((t) => t.key);
}

// ─── prioritizeTickets ──────────────────────────────────────────────────────

void describe("prioritizeTickets", () => {
  void it("returns fallback for single ticket without calling runner", async () => {
    let called = false;
    const runner = {
      run: async () => {
        called = true;
        return { code: 0, stdout: "" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;
    const { log } = collectLogs();

    const result = await prioritizeTickets(["EC-1"], REPOS, runner, "/dir", log);

    assert.equal(called, false);
    assert.equal(result.layers.length, 1);
    assert.deepEqual(keys(result.layers[0].group), ["EC-1"]);
  });

  void it("returns fallback for empty tickets without calling runner", async () => {
    let called = false;
    const runner = {
      run: async () => {
        called = true;
        return { code: 0, stdout: "" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;
    const { log } = collectLogs();

    const result = await prioritizeTickets([], REPOS, runner, "/dir", log);

    assert.equal(called, false);
    assert.deepEqual(keys(result.layers[0].group), []);
  });

  void it("parses successful prioritizer output", async () => {
    const output = JSON.stringify({
      layers: [
        {
          group: [
            { key: "EC-1", repos: [{ repo: "repo-a", branch: "ec-1-fix" }] },
            { key: "EC-2", repos: [{ repo: "repo-b", branch: "ec-2-fix" }] },
          ],
          relation: "same-epic",
          verification: { required: true, reason: "test" },
        },
        {
          group: [{ key: "EC-3", repos: [{ repo: "repo-a", branch: "ec-3-fix" }] }],
          relation: null,
          verification: { required: false, reason: "API-only" },
        },
      ],
      skipped: [{ key: "EC-4", reason: "blocked" }],
      excluded: [{ key: "EC-5", reason: "Done" }],
    });
    const runner = makeRunner({ code: 0, stdout: output });
    const { log } = collectLogs();

    const result = await prioritizeTickets(
      ["EC-1", "EC-2", "EC-3", "EC-4", "EC-5"],
      REPOS,
      runner,
      "/dir",
      log,
    );

    assert.equal(result.layers.length, 2);
    assert.deepEqual(keys(result.layers[0].group), ["EC-1", "EC-2"]);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.excluded.length, 1);
  });

  void it("falls back on non-zero exit code", async () => {
    const runner = makeRunner({ code: 1, stdout: "" });
    const { logs, log } = collectLogs();

    const result = await prioritizeTickets(["EC-1", "EC-2"], REPOS, runner, "/dir", log);

    assert.equal(result.layers.length, 1);
    assert.deepEqual(keys(result.layers[0].group), ["EC-1", "EC-2"]);
    assert.ok(logs.some((l) => l.includes("Falling back")));
  });

  void it("falls back on invalid JSON output", async () => {
    const runner = makeRunner({ code: 0, stdout: "not json" });
    const { logs, log } = collectLogs();

    const result = await prioritizeTickets(["EC-1", "EC-2"], REPOS, runner, "/dir", log);

    assert.deepEqual(keys(result.layers[0].group), ["EC-1", "EC-2"]);
    assert.ok(logs.some((l) => l.includes("parse failed")));
  });

  void it("falls back when output has empty layers", async () => {
    const output = JSON.stringify({ layers: [], skipped: [], excluded: [] });
    const runner = makeRunner({ code: 0, stdout: output });
    const { log } = collectLogs();

    const result = await prioritizeTickets(["EC-1", "EC-2"], REPOS, runner, "/dir", log);

    assert.deepEqual(keys(result.layers[0].group), ["EC-1", "EC-2"]);
  });

  void it("logs prioritization summary on success", async () => {
    const output = JSON.stringify({
      layers: [
        {
          group: [{ key: "EC-1", repos: [{ repo: "repo-a", branch: "ec-1-fix" }] }],
          relation: null,
          verification: { required: true, reason: "test" },
        },
      ],
      skipped: [],
      excluded: [],
    });
    const runner = makeRunner({ code: 0, stdout: output });
    const { logs, log } = collectLogs();

    await prioritizeTickets(["EC-1", "EC-2"], REPOS, runner, "/dir", log);

    assert.ok(logs.some((l) => l.includes("PRIORITIZED: 1 layer(s)")));
  });

  void it("logs skipped and excluded tickets", async () => {
    const output = JSON.stringify({
      layers: [
        {
          group: [{ key: "EC-1", repos: [{ repo: "repo-a", branch: "ec-1-fix" }] }],
          relation: null,
          verification: { required: true, reason: "test" },
        },
      ],
      skipped: [{ key: "EC-2", reason: "blocked" }],
      excluded: [{ key: "EC-3", reason: "Done" }],
    });
    const runner = makeRunner({ code: 0, stdout: output });
    const { logs, log } = collectLogs();

    await prioritizeTickets(["EC-1", "EC-2", "EC-3"], REPOS, runner, "/dir", log);

    assert.ok(logs.some((l) => l.includes("SKIPPED: EC-2")));
    assert.ok(logs.some((l) => l.includes("EXCLUDED: EC-3")));
  });

  void it("passes correct options to runner", async () => {
    let capturedOpts: Record<string, unknown> = {};
    const runner = {
      run: async (_prompt: string, opts: Record<string, unknown>) => {
        capturedOpts = opts;
        return { code: 1, stdout: "" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;
    const { log } = collectLogs();

    await prioritizeTickets(["EC-1", "EC-2"], REPOS, runner, "/my/dir", log);

    assert.equal(capturedOpts.cwd, "/my/dir");
    assert.equal(capturedOpts.model, "opus");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test assertion on captured mock data
    assert.ok((capturedOpts.taskName as string).includes("prioritizing 2 tickets"));
  });

  void it("includes ticket list and repo names in prompt", async () => {
    let capturedPrompt = "";
    const runner = {
      run: async (prompt: string) => {
        capturedPrompt = prompt;
        return { code: 1, stdout: "" };
      },
      writeLog: () => "/fake",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
    } as unknown as ClaudeRunner;
    const { log } = collectLogs();

    await prioritizeTickets(["EC-1", "EC-2", "EC-3"], REPOS, runner, "/dir", log);

    assert.ok(capturedPrompt.includes("EC-1,EC-2,EC-3"));
    assert.ok(capturedPrompt.includes("jira-ticket-prioritizer"));
    assert.ok(capturedPrompt.includes("repo-a"));
  });
});
