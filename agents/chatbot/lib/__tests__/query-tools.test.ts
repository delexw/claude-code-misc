/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Module mocks (must come before imports) ──────────────────────────────────

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  tool: vi.fn(),
  createSdkMcpServer: vi.fn(() => ({ name: "agents" })),
  query: vi.fn(),
}));

vi.mock("@a2a-js/sdk/client", () => ({
  ClientFactory: vi.fn(),
}));

vi.mock("@/a2a/lib/base-server", () => ({
  readPortsManifest: vi.fn(),
}));

vi.mock("@/lib/launchd", () => ({
  installAgent: vi.fn(),
  uninstallAgent: vi.fn(),
  loadAgent: vi.fn(),
  unloadAgent: vi.fn(),
  isLoaded: vi.fn(),
  getAgentStatus: vi.fn(),
  getAgentLogs: vi.fn(),
}));

vi.mock("@/lib/paths", () => ({
  AGENTS_ROOT: "/mock/agents",
  SCHEDULER_LOGS: "/mock/logs",
  SCHEDULER_STATE: "/mock/state",
}));

vi.mock("@@/lib/paths", () => ({
  LAUNCH_AGENTS_DIR: "/mock/launch-agents",
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { tool, createSdkMcpServer, query } from "@anthropic-ai/claude-agent-sdk";
import { ClientFactory } from "@a2a-js/sdk/client";
import { readPortsManifest } from "@/a2a/lib/base-server";
import {
  installAgent,
  uninstallAgent,
  loadAgent,
  unloadAgent,
  isLoaded,
  getAgentStatus,
  getAgentLogs,
} from "@/lib/launchd";
import { MGMT_TOOL, makeA2ATool, makeQueryTool, doveToolName } from "@/lib/query-tools";
import type { AgentDef } from "@@/lib/agents";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const AGENT: AgentDef = {
  name: "test-agent",
  entryPath: "src/test-agent/main.ts",
  displayName: "Test Agent",
  label: "Claude Code Agent - Test Agent",
  manifestKey: "test_agent",
  toolName: "yolo_test_agent",
  description: "A test agent for unit tests",
  requiredEnvVars: ["TEST_VAR"],
  scheduleDisplay: "daily 00:00",
  icon: {} as any,
};

// Capture tool handlers by name across all tool() calls in a factory invocation
function captureTools(fn: () => void): Record<string, (...args: any[]) => any> {
  const captured: Record<string, (...args: any[]) => any> = {};
  vi.mocked(tool).mockImplementation((name: string, _desc: any, _schema: any, handler: any) => {
    captured[name] = handler;
    return { name } as any;
  });
  fn();
  return captured;
}

async function* asyncEvents(...events: object[]) {
  for (const e of events) yield e;
}

// ─── doveToolName ─────────────────────────────────────────────────────────────

describe("doveToolName", () => {
  it("returns ask_<manifestKey>", () => {
    expect(doveToolName(AGENT)).toBe(`ask_${AGENT.manifestKey}`);
  });
});

// ─── MGMT_TOOL ────────────────────────────────────────────────────────────────

describe("MGMT_TOOL", () => {
  it("has all 6 management tool names", () => {
    expect(Object.keys(MGMT_TOOL)).toHaveLength(6);
  });

  it("maps to expected string values", () => {
    expect(MGMT_TOOL.install).toBe("install_agent");
    expect(MGMT_TOOL.uninstall).toBe("uninstall_agent");
    expect(MGMT_TOOL.load).toBe("load_agent");
    expect(MGMT_TOOL.unload).toBe("unload_agent");
    expect(MGMT_TOOL.status).toBe("check_status");
    expect(MGMT_TOOL.logs).toBe("get_logs");
  });
});

// ─── makeA2ATool ──────────────────────────────────────────────────────────────

describe("makeA2ATool", () => {
  let handler: (...args: any[]) => any;

  beforeEach(() => {
    vi.clearAllMocks();
    const captured = captureTools(() => makeA2ATool(AGENT));
    handler = captured[AGENT.toolName];
  });

  it("registers a tool with the agent toolName", () => {
    expect(vi.mocked(tool)).toHaveBeenCalledWith(
      AGENT.toolName,
      AGENT.description,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns servers-not-running message when manifest is null", async () => {
    vi.mocked(readPortsManifest).mockReturnValue(null);
    const result = await handler({ instruction: "run" });
    expect(result.content[0].text).toContain("npm run servers");
  });

  it("collects text parts from artifact-update events", async () => {
    vi.mocked(readPortsManifest).mockReturnValue({ test_agent: 51001 } as any);
    const mockSend = vi
      .fn()
      .mockReturnValue(
        asyncEvents(
          { kind: "artifact-update", artifact: { parts: [{ kind: "text", text: "hello" }] } },
          { kind: "artifact-update", artifact: { parts: [{ kind: "text", text: "world" }] } },
        ),
      );
    vi.mocked(ClientFactory).mockImplementation(
      () => ({ createFromUrl: vi.fn().mockResolvedValue({ sendMessageStream: mockSend }) }) as any,
    );

    const result = await handler({ instruction: "run" });
    expect(result.content[0].text).toBe("hello\nworld");
  });

  it("skips non-text parts in artifact events", async () => {
    vi.mocked(readPortsManifest).mockReturnValue({ test_agent: 51001 } as any);
    const mockSend = vi.fn().mockReturnValue(
      asyncEvents({
        kind: "artifact-update",
        artifact: {
          parts: [
            { kind: "data", data: {} },
            { kind: "text", text: "only this" },
          ],
        },
      }),
    );
    vi.mocked(ClientFactory).mockImplementation(
      () => ({ createFromUrl: vi.fn().mockResolvedValue({ sendMessageStream: mockSend }) }) as any,
    );

    const result = await handler({ instruction: "run" });
    expect(result.content[0].text).toBe("only this");
  });

  it("returns 'Agent completed.' when no chunks collected", async () => {
    vi.mocked(readPortsManifest).mockReturnValue({ test_agent: 51001 } as any);
    const mockSend = vi.fn().mockReturnValue(asyncEvents());
    vi.mocked(ClientFactory).mockImplementation(
      () => ({ createFromUrl: vi.fn().mockResolvedValue({ sendMessageStream: mockSend }) }) as any,
    );

    const result = await handler({ instruction: "run" });
    expect(result.content[0].text).toBe("Agent completed.");
  });

  it("uses 'run' as default instruction", async () => {
    vi.mocked(readPortsManifest).mockReturnValue({ test_agent: 51001 } as any);
    const mockSend = vi.fn().mockReturnValue(asyncEvents());
    const mockClient = { sendMessageStream: mockSend };
    vi.mocked(ClientFactory).mockImplementation(
      () => ({ createFromUrl: vi.fn().mockResolvedValue(mockClient) }) as any,
    );

    await handler({});
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ parts: [{ kind: "text", text: "run" }] }),
      }),
    );
  });

  it("returns unreachable message on ECONNREFUSED", async () => {
    vi.mocked(readPortsManifest).mockReturnValue({ test_agent: 51001 } as any);
    vi.mocked(ClientFactory).mockImplementation(
      () =>
        ({
          createFromUrl: vi
            .fn()
            .mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:51001")),
        }) as any,
    );

    const result = await handler({ instruction: "run" });
    expect(result.content[0].text).toContain("unreachable");
    expect(result.content[0].text).toContain("npm run servers");
  });

  it("returns unreachable message on ENOTFOUND", async () => {
    vi.mocked(readPortsManifest).mockReturnValue({ test_agent: 51001 } as any);
    vi.mocked(ClientFactory).mockImplementation(
      () => ({ createFromUrl: vi.fn().mockRejectedValue(new Error("ENOTFOUND localhost")) }) as any,
    );

    const result = await handler({ instruction: "run" });
    expect(result.content[0].text).toContain("unreachable");
  });

  it("returns generic error message for other errors", async () => {
    vi.mocked(readPortsManifest).mockReturnValue({ test_agent: 51001 } as any);
    vi.mocked(ClientFactory).mockImplementation(
      () => ({ createFromUrl: vi.fn().mockRejectedValue(new Error("unexpected failure")) }) as any,
    );

    const result = await handler({ instruction: "run" });
    expect(result.content[0].text).toBe("Error: unexpected failure");
  });
});

// ─── makeQueryTool — outer tool ───────────────────────────────────────────────

describe("makeQueryTool (outer tool)", () => {
  let outerHandler: (...args: any[]) => any;

  beforeEach(() => {
    vi.clearAllMocks();
    const abort = new AbortController();
    const captured = captureTools(() => makeQueryTool(AGENT, abort));
    outerHandler = captured[doveToolName(AGENT)];
  });

  it("registers outer tool with doveToolName", () => {
    const calls = vi.mocked(tool).mock.calls.filter(([name]) => name === doveToolName(AGENT));
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it("returns the result from a successful query()", async () => {
    vi.mocked(query).mockReturnValue(
      asyncEvents({ type: "result", subtype: "success", result: "agent says hi" }) as any,
    );
    const result = await outerHandler({ instruction: "say hi" });
    expect(result.content[0].text).toBe("agent says hi");
  });

  it("returns 'Agent completed.' when result is empty string", async () => {
    vi.mocked(query).mockReturnValue(
      asyncEvents({ type: "result", subtype: "success", result: "" }) as any,
    );
    const result = await outerHandler({ instruction: "run" });
    expect(result.content[0].text).toBe("Agent completed.");
  });

  it("returns 'Agent completed.' when no result event is emitted", async () => {
    vi.mocked(query).mockReturnValue(asyncEvents() as any);
    const result = await outerHandler({ instruction: "run" });
    expect(result.content[0].text).toBe("Agent completed.");
  });

  it("returns error message when query() throws", async () => {
    vi.mocked(query).mockImplementation(() => {
      throw new Error("sub-agent crashed");
    });
    const result = await outerHandler({ instruction: "run" });
    expect(result.content[0].text).toBe("Error: sub-agent crashed");
  });

  it("passes the instruction as prompt to query()", async () => {
    vi.mocked(query).mockReturnValue(asyncEvents() as any);
    await outerHandler({ instruction: "custom task" });
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "custom task" }),
    );
  });

  it("passes abortController to query()", async () => {
    vi.clearAllMocks();
    const abort = new AbortController();
    const captured = captureTools(() => makeQueryTool(AGENT, abort));
    vi.mocked(query).mockReturnValue(asyncEvents() as any);

    await captured[doveToolName(AGENT)]({ instruction: "run" });

    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ abortController: abort }),
      }),
    );
  });

  it("sets agent name to agent displayName", async () => {
    vi.mocked(query).mockReturnValue(asyncEvents() as any);
    await outerHandler({ instruction: "run" });

    const options = vi.mocked(query).mock.calls[0][0].options;
    expect(options.agent).toBe(AGENT.displayName);
  });

  it("allowedTools includes agent toolName and all MGMT_TOOL values", async () => {
    vi.mocked(query).mockReturnValue(asyncEvents() as any);
    await outerHandler({ instruction: "run" });

    const options = vi.mocked(query).mock.calls[0][0].options;
    const expectedTools = [
      `mcp__agents__${AGENT.toolName}`,
      ...Object.values(MGMT_TOOL).map((n) => `mcp__agents__${n}`),
    ];
    expect(options.allowedTools).toEqual(expectedTools);
  });

  it("creates an inner MCP server for sub-agent", async () => {
    vi.mocked(query).mockReturnValue(asyncEvents() as any);
    await outerHandler({ instruction: "run" });
    expect(vi.mocked(createSdkMcpServer)).toHaveBeenCalled();
  });
});

// ─── makeQueryTool — management tool handlers ─────────────────────────────────

describe("makeQueryTool management tools", () => {
  let captured: Record<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.clearAllMocks();
    const abort = new AbortController();
    captured = captureTools(() => makeQueryTool(AGENT, abort));
  });

  describe("install_agent", () => {
    it("returns success message when loaded", async () => {
      vi.mocked(installAgent).mockResolvedValue({ loaded: true } as any);
      const result = await captured[MGMT_TOOL.install]({});
      expect(result.content[0].text).toContain("installed and loaded");
      expect(result.content[0].text).toContain(AGENT.displayName);
    });

    it("returns warning when plist written but not loaded", async () => {
      vi.mocked(installAgent).mockResolvedValue({ loaded: false } as any);
      const result = await captured[MGMT_TOOL.install]({});
      expect(result.content[0].text).toContain("not loaded");
    });
  });

  describe("uninstall_agent", () => {
    it("calls uninstallAgent and returns confirmation", async () => {
      vi.mocked(uninstallAgent).mockResolvedValue(undefined);
      const result = await captured[MGMT_TOOL.uninstall]({});
      expect(vi.mocked(uninstallAgent)).toHaveBeenCalledWith(AGENT);
      expect(result.content[0].text).toContain("unloaded and plist deleted");
    });
  });

  describe("load_agent", () => {
    it("returns loaded confirmation when isLoaded returns true", async () => {
      vi.mocked(loadAgent).mockResolvedValue(undefined);
      vi.mocked(isLoaded).mockResolvedValue(true);
      const result = await captured[MGMT_TOOL.load]({});
      expect(result.content[0].text).toContain("loaded");
      expect(result.content[0].text).not.toContain("not showing");
    });

    it("returns warning when isLoaded returns false after load attempt", async () => {
      vi.mocked(loadAgent).mockResolvedValue(undefined);
      vi.mocked(isLoaded).mockResolvedValue(false);
      const result = await captured[MGMT_TOOL.load]({});
      expect(result.content[0].text).toContain("not showing as loaded");
    });

    it("checks isLoaded with agent label", async () => {
      vi.mocked(loadAgent).mockResolvedValue(undefined);
      vi.mocked(isLoaded).mockResolvedValue(true);
      await captured[MGMT_TOOL.load]({});
      expect(vi.mocked(isLoaded)).toHaveBeenCalledWith(AGENT.label);
    });
  });

  describe("unload_agent", () => {
    it("calls unloadAgent and returns confirmation", async () => {
      vi.mocked(unloadAgent).mockResolvedValue(undefined);
      const result = await captured[MGMT_TOOL.unload]({});
      expect(vi.mocked(unloadAgent)).toHaveBeenCalledWith(AGENT);
      expect(result.content[0].text).toContain("unloaded");
    });
  });

  describe("check_status", () => {
    it("returns formatted status summary including loaded", async () => {
      vi.mocked(getAgentStatus).mockResolvedValue({
        state: "running",
        pid: 1234,
        lastExitCode: 0,
        raw: "raw launchctl output",
      } as any);
      vi.mocked(isLoaded).mockResolvedValue(true);
      const result = await captured[MGMT_TOOL.status]({});
      expect(result.content[0].text).toContain("loaded=true");
      expect(result.content[0].text).toContain("state=running");
      expect(result.content[0].text).toContain("pid=1234");
      expect(result.content[0].text).toContain("last_exit=0");
      expect(result.content[0].text).toContain("raw launchctl output");
    });

    it("shows loaded=false when agent is not loaded", async () => {
      vi.mocked(getAgentStatus).mockResolvedValue({
        state: null,
        pid: null,
        lastExitCode: null,
        raw: "",
      } as any);
      vi.mocked(isLoaded).mockResolvedValue(false);
      const result = await captured[MGMT_TOOL.status]({});
      expect(result.content[0].text).toContain("loaded=false");
    });

    it("uses 'unknown' and '-' for null status fields", async () => {
      vi.mocked(getAgentStatus).mockResolvedValue({
        state: null,
        pid: null,
        lastExitCode: null,
        raw: "",
      } as any);
      vi.mocked(isLoaded).mockResolvedValue(false);
      const result = await captured[MGMT_TOOL.status]({});
      expect(result.content[0].text).toContain("state=unknown");
      expect(result.content[0].text).toContain("pid=-");
      expect(result.content[0].text).toContain("last_exit=-");
    });
  });

  describe("get_logs", () => {
    it("returns log output", async () => {
      vi.mocked(getAgentLogs).mockReturnValue("log line 1\nlog line 2");
      const result = await captured[MGMT_TOOL.logs]({ lines: 50 });
      expect(result.content[0].text).toBe("log line 1\nlog line 2");
    });

    it("passes lines parameter to getAgentLogs", async () => {
      vi.mocked(getAgentLogs).mockReturnValue("");
      await captured[MGMT_TOOL.logs]({ lines: 200 });
      expect(vi.mocked(getAgentLogs)).toHaveBeenCalledWith(AGENT, 200);
    });
  });
});
