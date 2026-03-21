/**
 * Tests for the 5 A2A agent server configuration modules.
 * Verifies each exports startServer(), references a real script file,
 * and documents the expected required env vars.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AGENTS_ROOT } from "@/lib/paths";

vi.mock("express", () => {
  const app = {
    use: vi.fn(),
    listen: vi.fn((_p: unknown, _h: unknown, cb?: () => void) => cb?.()),
  };
  return { default: vi.fn(() => app) };
});
vi.mock("@a2a-js/sdk", () => ({ AGENT_CARD_PATH: ".well-known/agent-card.json" }));
vi.mock("@a2a-js/sdk/server", () => ({
  DefaultRequestHandler: vi.fn(),
  InMemoryTaskStore: vi.fn(),
}));
vi.mock("@a2a-js/sdk/server/express", () => ({
  agentCardHandler: vi.fn(),
  jsonRpcHandler: vi.fn(),
  restHandler: vi.fn(),
  UserBuilder: { noAuthentication: {} },
}));
vi.mock("consola", () => ({
  consola: { start: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

import * as experienceReflector from "../experience-reflector";
import * as getShitDone from "../get-shit-done";
import * as releaseLogSentinel from "../release-log-sentinel";
import * as memoryDistiller from "../memory-distiller";
import * as oncallAnalyzer from "../oncall-analyzer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AGENTS = [
  {
    name: "experience-reflector",
    mod: experienceReflector,
    requiredVars: ["CHECKPOINT_REPOS"],
  },
  {
    name: "get-shit-done",
    mod: getShitDone,
    requiredVars: ["GSD_REPOS", "JIRA_ASSIGNEE"],
  },
  {
    name: "release-log-sentinel",
    mod: releaseLogSentinel,
    requiredVars: [] as string[],
  },
  {
    name: "memory-distiller",
    mod: memoryDistiller,
    requiredVars: ["MEMORY_REPOS"],
  },
  {
    name: "oncall-analyzer",
    mod: oncallAnalyzer,
    requiredVars: ["PIR_REPOS", "PIR_DOMAIN"],
  },
] as const;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe.each(AGENTS)("$name server", ({ name, mod, requiredVars }) => {
  it("exports a startServer function", () => {
    expect(typeof mod.startServer).toBe("function");
  });

  it("agent script exists in agents/src/", () => {
    const scriptPath = resolve(AGENTS_ROOT, `src/${name}.ts`);
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("source documents required env vars", () => {
    const src = readFileSync(resolve(__dirname, `../${name}.ts`), "utf-8");
    for (const v of requiredVars) {
      expect(src).toContain(v);
    }
  });
});
