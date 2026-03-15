import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prioritizeTickets } from "./prioritizer.js";
import type { ClaudeRunner, LogFn } from "./claude-runner.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function collectLogs(): { logs: string[]; log: LogFn } {
  const logs: string[] = [];
  return { logs, log: (msg: string) => logs.push(msg) };
}

function makeRunner(response: { code: number; stdout: string }): ClaudeRunner {
  return {
    run: async () => response,
    writeLog: () => "/fake/log",
  } as unknown as ClaudeRunner;
}

// ─── prioritizeTickets ──────────────────────────────────────────────────────

describe("prioritizeTickets", () => {
  it("returns fallback for single ticket without calling runner", async () => {
    let called = false;
    const runner = {
      run: async () => { called = true; return { code: 0, stdout: "" }; },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;
    const { log } = collectLogs();

    const result = await prioritizeTickets(["EC-1"], runner, "/dir", log);

    assert.equal(called, false);
    assert.equal(result.layers.length, 1);
    assert.deepEqual(result.layers[0].group, ["EC-1"]);
  });

  it("returns fallback for empty tickets without calling runner", async () => {
    let called = false;
    const runner = {
      run: async () => { called = true; return { code: 0, stdout: "" }; },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;
    const { log } = collectLogs();

    const result = await prioritizeTickets([], runner, "/dir", log);

    assert.equal(called, false);
    assert.deepEqual(result.layers[0].group, []);
  });

  it("parses successful prioritizer output", async () => {
    const output = JSON.stringify({
      layers: [
        { group: ["EC-1", "EC-2"], relation: "same-epic", hasFrontend: true },
        { group: ["EC-3"], relation: null, hasFrontend: false },
      ],
      skipped: [{ key: "EC-4", reason: "blocked" }],
      excluded: [{ key: "EC-5", reason: "Done" }],
    });
    const runner = makeRunner({ code: 0, stdout: output });
    const { log } = collectLogs();

    const result = await prioritizeTickets(
      ["EC-1", "EC-2", "EC-3", "EC-4", "EC-5"],
      runner, "/dir", log,
    );

    assert.equal(result.layers.length, 2);
    assert.deepEqual(result.layers[0].group, ["EC-1", "EC-2"]);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.excluded.length, 1);
  });

  it("falls back on non-zero exit code", async () => {
    const runner = makeRunner({ code: 1, stdout: "" });
    const { logs, log } = collectLogs();

    const result = await prioritizeTickets(["EC-1", "EC-2"], runner, "/dir", log);

    assert.equal(result.layers.length, 1);
    assert.deepEqual(result.layers[0].group, ["EC-1", "EC-2"]);
    assert.ok(logs.some((l) => l.includes("Falling back")));
  });

  it("falls back on invalid JSON output", async () => {
    const runner = makeRunner({ code: 0, stdout: "not json" });
    const { logs, log } = collectLogs();

    const result = await prioritizeTickets(["EC-1", "EC-2"], runner, "/dir", log);

    assert.deepEqual(result.layers[0].group, ["EC-1", "EC-2"]);
    assert.ok(logs.some((l) => l.includes("parse failed")));
  });

  it("falls back when output has empty layers", async () => {
    const output = JSON.stringify({ layers: [], skipped: [], excluded: [] });
    const runner = makeRunner({ code: 0, stdout: output });
    const { log } = collectLogs();

    const result = await prioritizeTickets(["EC-1", "EC-2"], runner, "/dir", log);

    assert.deepEqual(result.layers[0].group, ["EC-1", "EC-2"]);
  });

  it("logs prioritization summary on success", async () => {
    const output = JSON.stringify({
      layers: [{ group: ["EC-1"], relation: null, hasFrontend: true }],
      skipped: [],
      excluded: [],
    });
    const runner = makeRunner({ code: 0, stdout: output });
    const { logs, log } = collectLogs();

    await prioritizeTickets(["EC-1", "EC-2"], runner, "/dir", log);

    assert.ok(logs.some((l) => l.includes("PRIORITIZED: 1 layer(s)")));
  });

  it("logs skipped and excluded tickets", async () => {
    const output = JSON.stringify({
      layers: [{ group: ["EC-1"], relation: null, hasFrontend: true }],
      skipped: [{ key: "EC-2", reason: "blocked" }],
      excluded: [{ key: "EC-3", reason: "Done" }],
    });
    const runner = makeRunner({ code: 0, stdout: output });
    const { logs, log } = collectLogs();

    await prioritizeTickets(["EC-1", "EC-2", "EC-3"], runner, "/dir", log);

    assert.ok(logs.some((l) => l.includes("SKIPPED: EC-2")));
    assert.ok(logs.some((l) => l.includes("EXCLUDED: EC-3")));
  });

  it("passes correct options to runner", async () => {
    let capturedOpts: Record<string, unknown> = {};
    const runner = {
      run: async (_prompt: string, opts: Record<string, unknown>) => {
        capturedOpts = opts;
        return { code: 1, stdout: "" };
      },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;
    const { log } = collectLogs();

    await prioritizeTickets(["EC-1", "EC-2"], runner, "/my/dir", log);

    assert.equal(capturedOpts.cwd, "/my/dir");
    assert.equal(capturedOpts.model, "opus");
    assert.ok((capturedOpts.taskName as string).includes("prioritizing 2 tickets"));
  });

  it("includes ticket list in prompt", async () => {
    let capturedPrompt = "";
    const runner = {
      run: async (prompt: string) => {
        capturedPrompt = prompt;
        return { code: 1, stdout: "" };
      },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;
    const { log } = collectLogs();

    await prioritizeTickets(["EC-1", "EC-2", "EC-3"], runner, "/dir", log);

    assert.ok(capturedPrompt.includes("EC-1,EC-2,EC-3"));
    assert.ok(capturedPrompt.includes("jira-ticket-prioritizer"));
  });
});
