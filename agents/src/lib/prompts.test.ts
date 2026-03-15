import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  worktreePath,
  buildForgePrompt,
  buildMergePrompt,
  buildVerifyPrompt,
  buildPrPrompt,
  AUTONOMY_PREFIX,
} from "./prompts.js";

void describe("worktreePath", () => {
  void it("returns .claude/worktrees/<slug> under repo root", () => {
    assert.equal(
      worktreePath("/path/to/repo", "ec-123-repo"),
      "/path/to/repo/.claude/worktrees/ec-123-repo",
    );
  });
});

void describe("buildForgePrompt", () => {
  void it("includes ticket key and URL", () => {
    const result = buildForgePrompt("EC-123", "https://jira/EC-123", "");
    assert.ok(result.includes("[GSD: forge EC-123]"));
    assert.ok(result.includes("https://jira/EC-123"));
  });

  void it("appends dev server info when provided", () => {
    const devInfo = '{"urls": ["http://localhost:3000", "http://localhost:3500"]}';
    const result = buildForgePrompt("EC-1", "url", devInfo);
    assert.ok(result.includes("Dev servers are already running:"));
    assert.ok(result.includes(devInfo));
  });

  void it("omits dev server context when empty", () => {
    const result = buildForgePrompt("EC-1", "url", "");
    assert.ok(!result.includes("Dev servers are already running"));
  });

  void it("includes autonomy prefix", () => {
    const result = buildForgePrompt("EC-1", "url", "");
    assert.ok(result.includes(AUTONOMY_PREFIX));
  });
});

void describe("buildMergePrompt", () => {
  const wtPaths = ["/wt/ec-1", "/wt/ec-2"];

  void it("includes primary ticket in merge branch name", () => {
    const result = buildMergePrompt("EC-1", wtPaths);
    assert.ok(result.includes('"EC-1-merge"'));
  });

  void it("lists worktree paths", () => {
    const result = buildMergePrompt("EC-1", wtPaths);
    assert.ok(result.includes("/wt/ec-1"));
    assert.ok(result.includes("/wt/ec-2"));
  });
});

void describe("buildVerifyPrompt", () => {
  void it("includes dev URL and merge branch", () => {
    const result = buildVerifyPrompt("EC-1", "https://elements.envato.dev", "EC-1-merge");
    assert.ok(result.includes("https://elements.envato.dev"));
    assert.ok(result.includes("verification"));
    assert.ok(result.includes('merge branch "EC-1-merge"'));
  });
});

void describe("buildPrPrompt", () => {
  const forges = [
    {
      ticketKey: "EC-1",
      status: "success" as const,
      worktrees: [{ repoPath: "/repo", worktreePath: "/wt/ec-1" }],
    },
    {
      ticketKey: "EC-2",
      status: "success" as const,
      worktrees: [{ repoPath: "/repo", worktreePath: "/wt/ec-2" }],
    },
  ];

  void it("generates PR steps for each forge", () => {
    const result = buildPrPrompt(forges);
    assert.ok(result.includes("In worktree /wt/ec-1"));
    assert.ok(result.includes("In worktree /wt/ec-2"));
    assert.ok(result.includes("git-commit"));
    assert.ok(result.includes("create-pr"));
  });
});

// buildBootstrapPrompt tests removed — function deleted, servers now start from Node.js directly
