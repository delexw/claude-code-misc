import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { forgeTicket, forgeGroup } from "./forge.js";
import type { ClaudeRunner, LogFn } from "./claude-runner.js";
import type { JiraClient } from "./jira.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRunner(response: { code: number; stdout: string }): ClaudeRunner {
  return {
    run: async () => response,
    writeLog: () => "/fake/log",
  } as unknown as ClaudeRunner;
}

function makeJira(server = "https://jira.test"): JiraClient {
  return {
    ticketUrl: (key: string) => `${server}/browse/${key}`,
  } as unknown as JiraClient;
}

function collectLogs(): { logs: string[]; log: LogFn } {
  const logs: string[] = [];
  return { logs, log: (msg: string) => logs.push(msg) };
}

// ─── forgeTicket ─────────────────────────────────────────────────────────────

describe("forgeTicket", () => {
  it("returns success with worktree path on exit code 0", async () => {
    const stdout = 'some output\n{"worktree_path": "/tmp/wt-ec-1"}\nmore';
    const runner = makeRunner({ code: 0, stdout });
    const jira = makeJira();
    const { log } = collectLogs();

    const result = await forgeTicket("EC-1", ["/repo"], "", runner, jira, log);

    assert.equal(result.ticketKey, "EC-1");
    assert.equal(result.status, "success");
    assert.equal(result.worktreePath, "/tmp/wt-ec-1");
  });

  it("returns failed on non-zero exit code", async () => {
    const runner = makeRunner({ code: 1, stdout: "error" });
    const jira = makeJira();
    const { log } = collectLogs();

    const result = await forgeTicket("EC-2", ["/repo"], "", runner, jira, log);

    assert.equal(result.status, "failed");
    assert.equal(result.worktreePath, "");
  });

  it("logs forging start and result", async () => {
    const runner = makeRunner({ code: 0, stdout: '{"worktree_path": "/wt"}' });
    const jira = makeJira();
    const { logs, log } = collectLogs();

    await forgeTicket("EC-3", ["/repo"], "", runner, jira, log);

    assert.ok(logs.some((l) => l.includes("FORGING: EC-3")));
    assert.ok(logs.some((l) => l.includes("FORGED: EC-3")));
  });

  it("logs failure message on non-zero exit", async () => {
    const runner = makeRunner({ code: 1, stdout: "" });
    const jira = makeJira();
    const { logs, log } = collectLogs();

    await forgeTicket("EC-4", ["/repo"], "", runner, jira, log);

    assert.ok(logs.some((l) => l.includes("FORGE FAILED: EC-4")));
  });

  it("uses jira.ticketUrl for the ticket URL", async () => {
    let capturedPrompt = "";
    const runner = {
      run: async (prompt: string) => {
        capturedPrompt = prompt;
        return { code: 0, stdout: '{"worktree_path": "/wt"}' };
      },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;
    const jira = makeJira("https://custom.jira");
    const { log } = collectLogs();

    await forgeTicket("EC-5", ["/repo"], "", runner, jira, log);

    assert.ok(capturedPrompt.includes("https://custom.jira/browse/EC-5"));
  });

  it("calls runner.writeLog with task prefix", async () => {
    let loggedPrefix = "";
    let loggedId = "";
    const runner = {
      run: async () => ({ code: 0, stdout: '{"worktree_path": "/wt"}' }),
      writeLog: (prefix: string, id: string) => {
        loggedPrefix = prefix;
        loggedId = id;
        return "/fake";
      },
    } as unknown as ClaudeRunner;
    const jira = makeJira();
    const { log } = collectLogs();

    await forgeTicket("EC-6", ["/repo"], "", runner, jira, log);

    assert.equal(loggedPrefix, "task");
    assert.equal(loggedId, "EC-6");
  });
});

// ─── forgeGroup ──────────────────────────────────────────────────────────────

describe("forgeGroup", () => {
  it("returns results for all tickets in group", async () => {
    const runner = makeRunner({ code: 0, stdout: '{"worktree_path": "/wt"}' });
    const jira = makeJira();
    const { log } = collectLogs();

    const results = await forgeGroup(["EC-1", "EC-2"], ["/repo"], "", runner, jira, log);

    assert.equal(results.length, 2);
    assert.equal(results[0].ticketKey, "EC-1");
    assert.equal(results[1].ticketKey, "EC-2");
  });

  it("logs group start", async () => {
    const runner = makeRunner({ code: 0, stdout: '{"worktree_path": "/wt"}' });
    const jira = makeJira();
    const { logs, log } = collectLogs();

    await forgeGroup(["EC-1", "EC-2"], ["/repo"], "", runner, jira, log);

    assert.ok(logs.some((l) => l.includes("FORGING GROUP: EC-1, EC-2")));
  });

  it("handles mixed success and failure", async () => {
    let callCount = 0;
    const runner = {
      run: async () => {
        callCount++;
        if (callCount === 1) return { code: 0, stdout: '{"worktree_path": "/wt"}' };
        return { code: 1, stdout: "" };
      },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;
    const jira = makeJira();
    const { log } = collectLogs();

    const results = await forgeGroup(["EC-1", "EC-2"], ["/repo"], "", runner, jira, log);

    assert.equal(results[0].status, "success");
    assert.equal(results[1].status, "failed");
  });

  it("returns failed for rejected promises", async () => {
    const runner = {
      run: async () => {
        throw new Error("boom");
      },
      writeLog: () => "/fake",
    } as unknown as ClaudeRunner;
    const jira = makeJira();
    const { log } = collectLogs();

    const results = await forgeGroup(["EC-1"], ["/repo"], "", runner, jira, log);

    assert.equal(results[0].status, "failed");
    assert.equal(results[0].ticketKey, "EC-1");
    assert.equal(results[0].worktreePath, "");
  });

  it("handles empty group", async () => {
    const runner = makeRunner({ code: 0, stdout: "" });
    const jira = makeJira();
    const { log } = collectLogs();

    const results = await forgeGroup([], ["/repo"], "", runner, jira, log);

    assert.equal(results.length, 0);
  });
});
