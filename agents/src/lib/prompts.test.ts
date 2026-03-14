import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractWorktreePath,
  buildForgePrompt,
  buildGroupPrompt,
  buildBootstrapPrompt,
  AUTONOMY_PREFIX,
} from "./prompts.js";

describe("extractWorktreePath", () => {
  it("extracts worktree_path from JSON in stdout", () => {
    const stdout = 'some output\n{"worktree_path": "/tmp/wt-123"}\nmore output';
    assert.equal(extractWorktreePath(stdout), "/tmp/wt-123");
  });

  it("returns empty string when no JSON found", () => {
    assert.equal(extractWorktreePath("no json here"), "");
  });

  it("returns empty string for empty worktree_path", () => {
    const stdout = '{"worktree_path": ""}';
    assert.equal(extractWorktreePath(stdout), "");
  });

  it("returns empty string for invalid JSON", () => {
    const stdout = '{"worktree_path": broken}';
    assert.equal(extractWorktreePath(stdout), "");
  });

  it("returns empty string for empty input", () => {
    assert.equal(extractWorktreePath(""), "");
  });

  it("picks first match when multiple JSON objects exist", () => {
    const stdout =
      '{"worktree_path": "/first"}\n{"worktree_path": "/second"}';
    assert.equal(extractWorktreePath(stdout), "/first");
  });
});

describe("buildForgePrompt", () => {
  it("includes ticket key and URL", () => {
    const result = buildForgePrompt("EC-123", "https://jira/EC-123", ["/repo"], "");
    assert.ok(result.includes("[GSD: forge EC-123]"));
    assert.ok(result.includes("https://jira/EC-123"));
  });

  it("includes repo list", () => {
    const result = buildForgePrompt("EC-1", "url", ["/repo-a", "/repo-b"], "");
    assert.ok(result.includes("/repo-a"));
    assert.ok(result.includes("/repo-b"));
  });

  it("appends dev server info when provided", () => {
    const devInfo = '{"urls": ["http://localhost:3000", "http://localhost:3500"]}';
    const result = buildForgePrompt("EC-1", "url", ["/repo"], devInfo);
    assert.ok(result.includes("Dev servers are already running:"));
    assert.ok(result.includes(devInfo));
  });

  it("omits dev server context when empty", () => {
    const result = buildForgePrompt("EC-1", "url", ["/repo"], "");
    assert.ok(!result.includes("Dev servers are already running"));
  });

  it("includes autonomy prefix", () => {
    const result = buildForgePrompt("EC-1", "url", [], "");
    assert.ok(result.includes(AUTONOMY_PREFIX));
  });
});

describe("buildGroupPrompt", () => {
  const forges = [
    { ticketKey: "EC-1", status: "success" as const, worktreePath: "/wt/ec-1" },
    { ticketKey: "EC-2", status: "success" as const, worktreePath: "/wt/ec-2" },
  ];

  it("includes primary ticket in merge branch name", () => {
    const result = buildGroupPrompt("EC-1", forges, ["/repo"], true);
    assert.ok(result.includes('"EC-1-merge"'));
  });

  it("lists worktree paths", () => {
    const result = buildGroupPrompt("EC-1", forges, ["/repo"], true);
    assert.ok(result.includes("EC-1:/wt/ec-1"));
    assert.ok(result.includes("EC-2:/wt/ec-2"));
  });

  it("includes bootstrap and verification steps when hasFrontend is true", () => {
    const result = buildGroupPrompt("EC-1", forges, ["/repo"], true);
    assert.ok(result.includes("Bootstrap all dev services"));
    assert.ok(result.includes("verification"));
    assert.ok(result.includes("Kill all dev servers"));
  });

  it("skips bootstrap and kill steps when hasFrontend is false", () => {
    const result = buildGroupPrompt("EC-1", forges, ["/repo"], false);
    assert.ok(!result.includes("Bootstrap all dev services"));
    assert.ok(!result.includes("Kill all dev servers"));
    assert.ok(result.includes("verification"));
  });

  it("generates PR steps starting at 7 when hasFrontend", () => {
    const result = buildGroupPrompt("EC-1", forges, ["/repo"], true);
    assert.ok(result.includes("7. In worktree /wt/ec-1"));
    assert.ok(result.includes("8. In worktree /wt/ec-2"));
  });

  it("generates PR steps starting at 5 when no frontend", () => {
    const result = buildGroupPrompt("EC-1", forges, ["/repo"], false);
    assert.ok(result.includes("5. In worktree /wt/ec-1"));
    assert.ok(result.includes("6. In worktree /wt/ec-2"));
  });

  it("includes repo list in bootstrap steps", () => {
    const result = buildGroupPrompt("EC-1", forges, ["/repo-a", "/repo-b"], true);
    assert.ok(result.includes("/repo-a"));
    assert.ok(result.includes("/repo-b"));
  });
});

describe("buildBootstrapPrompt", () => {
  it("includes all 5 bootstrap skills", () => {
    const result = buildBootstrapPrompt();
    assert.ok(result.includes("elements-backend-bootstrap"));
    assert.ok(result.includes("elements-storefront-bootstrap"));
    assert.ok(result.includes("elements-payment-bootstrap"));
    assert.ok(result.includes("elements-search-bootstrap"));
    assert.ok(result.includes("sso-server-bootstrap"));
  });

  it("instructs to fetch main and bootstrap on main branch", () => {
    const result = buildBootstrapPrompt();
    assert.ok(result.includes("fetch main to up-to-date and bootstrap on main branch"));
  });

  it("requests JSON output with urls field", () => {
    const result = buildBootstrapPrompt();
    assert.ok(result.includes('"urls"'));
    assert.ok(result.includes("JSON object"));
  });

  it("includes autonomy prefix", () => {
    const result = buildBootstrapPrompt();
    assert.ok(result.includes(AUTONOMY_PREFIX));
  });
});
