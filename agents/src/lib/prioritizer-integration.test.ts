import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prioritizer } from "./prioritizer.js";
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

function makePrioritizer(runner: ClaudeRunner, log: LogFn): Prioritizer {
  return new Prioritizer({ runner, scriptDir: "/dir", log });
}

function keys(group: Array<{ key: string }>): string[] {
  return group.map((t) => t.key);
}

// ─── prioritize ─────────────────────────────────────────────────────────────

void describe("Prioritizer.prioritize", () => {
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
    const prioritizer = makePrioritizer(runner, log);

    const { resolved } = await prioritizer.prioritize(["EC-1"], REPOS);

    assert.equal(called, false);
    assert.equal(resolved.layers.length, 1);
    assert.deepEqual(keys(resolved.layers[0].group), ["EC-1"]);
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
    const prioritizer = makePrioritizer(runner, log);

    const { resolved } = await prioritizer.prioritize([], REPOS);

    assert.equal(called, false);
    assert.deepEqual(keys(resolved.layers[0].group), []);
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
    const prioritizer = makePrioritizer(runner, log);

    const { resolved } = await prioritizer.prioritize(
      ["EC-1", "EC-2", "EC-3", "EC-4", "EC-5"],
      REPOS,
    );

    assert.equal(resolved.layers.length, 2);
    assert.deepEqual(keys(resolved.layers[0].group), ["EC-1", "EC-2"]);
    assert.equal(resolved.skipped.length, 1);
    assert.equal(resolved.excluded.length, 1);
  });

  void it("raw contains basenames while resolved contains full paths", async () => {
    const output = JSON.stringify({
      layers: [
        {
          group: [{ key: "EC-1", repos: [{ repo: "repo-a", branch: "ec-1-fix" }] }],
          relation: null,
          verification: { required: false, reason: "test" },
        },
      ],
      skipped: [],
      excluded: [],
    });
    const runner = makeRunner({ code: 0, stdout: output });
    const { log } = collectLogs();
    const prioritizer = makePrioritizer(runner, log);

    const { resolved, raw } = await prioritizer.prioritize(["EC-1", "EC-2"], REPOS);

    // resolved has full paths
    assert.equal(resolved.layers[0].group[0].repos[0].repoPath, "/repo-a");
    // raw has basenames
    assert.equal(raw.layers[0].group[0].repos[0].repoPath, "repo-a");
  });

  void it("raw and resolved are independent copies", async () => {
    const output = JSON.stringify({
      layers: [
        {
          group: [{ key: "EC-1", repos: [{ repo: "repo-a", branch: "ec-1-fix" }] }],
          relation: null,
          verification: { required: false, reason: "test" },
        },
      ],
      skipped: [],
      excluded: [],
    });
    const runner = makeRunner({ code: 0, stdout: output });
    const { log } = collectLogs();
    const prioritizer = makePrioritizer(runner, log);

    const { resolved, raw } = await prioritizer.prioritize(["EC-1", "EC-2"], REPOS);

    // mutating resolved does not affect raw
    resolved.layers[0].group[0].repos[0].repoPath = "/mutated";
    assert.equal(raw.layers[0].group[0].repos[0].repoPath, "repo-a");
  });

  void it("raw preserves all fields across multiple layers and repos", async () => {
    const output = JSON.stringify({
      layers: [
        {
          group: [
            { key: "EC-1", repos: [{ repo: "repo-a", branch: "ec-1-fix" }] },
            { key: "EC-2", repos: [{ repo: "repo-b", branch: "ec-2-fix" }] },
          ],
          relation: "same-epic",
          verification: { required: true, reason: "UI change" },
          depends_on: null,
        },
        {
          group: [{ key: "EC-3", repos: [{ repo: "repo-a", branch: "ec-3-fix" }] }],
          relation: null,
          verification: { required: false, reason: "API-only" },
          depends_on: "EC-1",
        },
      ],
      skipped: [{ key: "EC-4", reason: "blocked" }],
      excluded: [{ key: "EC-5", reason: "Done" }],
    });
    const runner = makeRunner({ code: 0, stdout: output });
    const { log } = collectLogs();
    const prioritizer = makePrioritizer(runner, log);

    const { resolved, raw } = await prioritizer.prioritize(
      ["EC-1", "EC-2", "EC-3", "EC-4", "EC-5"],
      REPOS,
    );

    // raw basenames for all tickets across layers
    assert.equal(raw.layers[0].group[0].repos[0].repoPath, "repo-a");
    assert.equal(raw.layers[0].group[1].repos[0].repoPath, "repo-b");
    assert.equal(raw.layers[1].group[0].repos[0].repoPath, "repo-a");

    // resolved full paths for all
    assert.equal(resolved.layers[0].group[0].repos[0].repoPath, "/repo-a");
    assert.equal(resolved.layers[0].group[1].repos[0].repoPath, "/repo-b");
    assert.equal(resolved.layers[1].group[0].repos[0].repoPath, "/repo-a");

    // non-repo fields preserved in both
    assert.equal(raw.layers[0].relation, "same-epic");
    assert.equal(raw.layers[1].dependsOn, "EC-1");
    assert.deepEqual(raw.skipped, [{ key: "EC-4", reason: "blocked" }]);
    assert.deepEqual(raw.excluded, [{ key: "EC-5", reason: "Done" }]);
    assert.equal(raw.layers[0].group[0].repos[0].branch, "ec-1-fix");
  });

  void it("fallback single ticket returns same raw and resolved", async () => {
    const runner = makeRunner({ code: 0, stdout: "" });
    const { log } = collectLogs();
    const prioritizer = makePrioritizer(runner, log);

    const { resolved, raw } = await prioritizer.prioritize(["EC-1"], REPOS);

    assert.deepEqual(keys(resolved.layers[0].group), ["EC-1"]);
    assert.deepEqual(keys(raw.layers[0].group), ["EC-1"]);
    // fallback has no repos to resolve, so both should match
    assert.deepEqual(resolved.layers.length, raw.layers.length);
  });

  void it("throws on non-zero exit code", async () => {
    const runner = makeRunner({ code: 1, stdout: "" });
    const { log } = collectLogs();
    const prioritizer = makePrioritizer(runner, log);

    await assert.rejects(
      () => prioritizer.prioritize(["EC-1", "EC-2"], REPOS),
      /exited with code 1/,
    );
  });

  void it("throws on invalid JSON output", async () => {
    const runner = makeRunner({ code: 0, stdout: "not json" });
    const { log } = collectLogs();
    const prioritizer = makePrioritizer(runner, log);

    await assert.rejects(() => prioritizer.prioritize(["EC-1", "EC-2"], REPOS), /parse failed/);
  });

  void it("throws when output has empty layers", async () => {
    const output = JSON.stringify({ layers: [], skipped: [], excluded: [] });
    const runner = makeRunner({ code: 0, stdout: output });
    const { log } = collectLogs();
    const prioritizer = makePrioritizer(runner, log);

    await assert.rejects(() => prioritizer.prioritize(["EC-1", "EC-2"], REPOS), /parse failed/);
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
    const prioritizer = makePrioritizer(runner, log);

    await prioritizer.prioritize(["EC-1", "EC-2"], REPOS);

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
    const prioritizer = makePrioritizer(runner, log);

    await prioritizer.prioritize(["EC-1", "EC-2", "EC-3"], REPOS);

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
    const prioritizer = new Prioritizer({ runner, scriptDir: "/my/dir", log });

    await assert.rejects(() => prioritizer.prioritize(["EC-1", "EC-2"], REPOS));

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
    const prioritizer = makePrioritizer(runner, log);

    await assert.rejects(() => prioritizer.prioritize(["EC-1", "EC-2", "EC-3"], REPOS));

    assert.ok(capturedPrompt.includes("EC-1,EC-2,EC-3"));
    assert.ok(capturedPrompt.includes("jira-ticket-prioritizer"));
    assert.ok(capturedPrompt.includes("repo-a"));
  });
});
