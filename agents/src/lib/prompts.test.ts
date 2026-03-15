import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractWorktreePath,
  buildForgePrompt,
  buildMergePrompt,
  buildVerifyPrompt,
  buildPrPrompt,
  AUTONOMY_PREFIX,
} from "./prompts.js";

void describe("extractWorktreePath", () => {
  void it("extracts worktree_path from JSON in stdout", () => {
    const stdout = 'some output\n{"worktree_path": "/tmp/wt-123"}\nmore output';
    assert.equal(extractWorktreePath(stdout), "/tmp/wt-123");
  });

  void it("returns empty string when no JSON found", () => {
    assert.equal(extractWorktreePath("no json here"), "");
  });

  void it("returns empty string for empty worktree_path", () => {
    const stdout = '{"worktree_path": ""}';
    assert.equal(extractWorktreePath(stdout), "");
  });

  void it("returns empty string for invalid JSON", () => {
    const stdout = '{"worktree_path": broken}';
    assert.equal(extractWorktreePath(stdout), "");
  });

  void it("returns empty string for empty input", () => {
    assert.equal(extractWorktreePath(""), "");
  });

  void it("picks first match when multiple JSON objects exist", () => {
    const stdout = '{"worktree_path": "/first"}\n{"worktree_path": "/second"}';
    assert.equal(extractWorktreePath(stdout), "/first");
  });
});

void describe("buildForgePrompt", () => {
  void it("includes ticket key and URL", () => {
    const result = buildForgePrompt("EC-123", "https://jira/EC-123", ["/repo"], "");
    assert.ok(result.includes("[GSD: forge EC-123]"));
    assert.ok(result.includes("https://jira/EC-123"));
  });

  void it("includes repo list", () => {
    const result = buildForgePrompt("EC-1", "url", ["/repo-a", "/repo-b"], "");
    assert.ok(result.includes("/repo-a"));
    assert.ok(result.includes("/repo-b"));
  });

  void it("appends dev server info when provided", () => {
    const devInfo = '{"urls": ["http://localhost:3000", "http://localhost:3500"]}';
    const result = buildForgePrompt("EC-1", "url", ["/repo"], devInfo);
    assert.ok(result.includes("Dev servers are already running:"));
    assert.ok(result.includes(devInfo));
  });

  void it("omits dev server context when empty", () => {
    const result = buildForgePrompt("EC-1", "url", ["/repo"], "");
    assert.ok(!result.includes("Dev servers are already running"));
  });

  void it("includes autonomy prefix", () => {
    const result = buildForgePrompt("EC-1", "url", [], "");
    assert.ok(result.includes(AUTONOMY_PREFIX));
  });
});

void describe("buildMergePrompt", () => {
  const forges = [
    { ticketKey: "EC-1", status: "success" as const, worktreePath: "/wt/ec-1" },
    { ticketKey: "EC-2", status: "success" as const, worktreePath: "/wt/ec-2" },
  ];

  void it("includes primary ticket in merge branch name", () => {
    const result = buildMergePrompt("EC-1", forges);
    assert.ok(result.includes('"EC-1-merge"'));
  });

  void it("lists worktree paths", () => {
    const result = buildMergePrompt("EC-1", forges);
    assert.ok(result.includes("EC-1: /wt/ec-1"));
    assert.ok(result.includes("EC-2: /wt/ec-2"));
  });
});

void describe("buildVerifyPrompt", () => {
  void it("includes dev URL", () => {
    const result = buildVerifyPrompt("EC-1", "https://elements.envato.dev");
    assert.ok(result.includes("https://elements.envato.dev"));
    assert.ok(result.includes("verification"));
  });
});

void describe("buildPrPrompt", () => {
  const forges = [
    { ticketKey: "EC-1", status: "success" as const, worktreePath: "/wt/ec-1" },
    { ticketKey: "EC-2", status: "success" as const, worktreePath: "/wt/ec-2" },
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
