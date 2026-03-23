import { writeFileSync, rmSync, existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock SETTINGS_FILE path before importing ─────────────────────────────────
// vi.hoisted must only use inline requires (imports are not available yet)

const { tmpFile } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("node:os") as typeof import("node:os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("node:path") as typeof import("node:path");
  return { tmpFile: path.join(os.tmpdir(), `settings-test-${Date.now()}.json`) };
});

vi.mock("@/lib/paths", () => ({
  SETTINGS_FILE: tmpFile,
}));

import { readSettings, writeSettings, makeRepository, defaultSettings } from "../settings";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function writeRaw(data: unknown) {
  writeFileSync(tmpFile, JSON.stringify(data), "utf-8");
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  if (existsSync(tmpFile)) rmSync(tmpFile);
});

afterEach(() => {
  if (existsSync(tmpFile)) rmSync(tmpFile);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("defaultSettings", () => {
  it("returns version 1 with empty repositories", () => {
    expect(defaultSettings()).toEqual({ version: 1, repositories: [] });
  });
});

describe("readSettings", () => {
  it("returns default when file does not exist", () => {
    expect(readSettings()).toEqual(defaultSettings());
  });

  it("returns default when file contains invalid JSON", () => {
    writeFileSync(tmpFile, "not json", "utf-8");
    expect(readSettings()).toEqual(defaultSettings());
  });

  it("returns default when schema validation fails", () => {
    writeRaw({ version: 2, repositories: [] });
    expect(readSettings()).toEqual(defaultSettings());
  });

  it("reads a valid settings file", () => {
    const settings = {
      version: 1 as const,
      repositories: [{ id: "abc", githubRepo: "org/bar", name: "bar" }],
    };
    writeRaw(settings);
    expect(readSettings()).toEqual(settings);
  });
});

describe("writeSettings", () => {
  it("writes settings to disk and can be read back", () => {
    const settings = {
      version: 1 as const,
      repositories: [{ id: "xyz", githubRepo: "org/repo", name: "repo" }],
    };
    writeSettings(settings);
    expect(readSettings()).toEqual(settings);
  });

  it("overwrites existing settings", () => {
    writeSettings({ version: 1, repositories: [{ id: "a", githubRepo: "org/a", name: "a" }] });
    writeSettings({ version: 1, repositories: [] });
    expect(readSettings().repositories).toHaveLength(0);
  });
});

describe("makeRepository", () => {
  it("derives name from the repo slug", () => {
    const repo = makeRepository("envato/elements-storefront");
    expect(repo.name).toBe("elements-storefront");
    expect(repo.githubRepo).toBe("envato/elements-storefront");
  });

  it("trims whitespace", () => {
    const repo = makeRepository("  org/foo  ");
    expect(repo.githubRepo).toBe("org/foo");
    expect(repo.name).toBe("foo");
  });

  it("generates a unique id", () => {
    const a = makeRepository("org/a");
    const b = makeRepository("org/b");
    expect(a.id).not.toBe(b.id);
  });
});
