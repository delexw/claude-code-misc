/**
 * MCP tool factories for the Dove chat API.
 *
 * makeA2ATool  — wraps an agent's A2A SSE endpoint as an MCP tool
 * makeQueryTool — wraps a query() sub-agent (with full launchd management) as an MCP tool
 */

import {
  tool,
  createSdkMcpServer,
  query,
  type SDKResultSuccess,
} from "@anthropic-ai/claude-agent-sdk";
import { ClientFactory } from "@a2a-js/sdk/client";
import type { TextPart } from "@a2a-js/sdk";
import { readPortsManifest } from "@/a2a/lib/base-server";
import type { PortsManifest } from "@/a2a/lib/base-server";
import { randomUUID } from "node:crypto";
import { AGENTS_ROOT, SCHEDULER_LOGS, SCHEDULER_STATE } from "@/lib/paths";
import { LAUNCH_AGENTS_DIR } from "@@/lib/paths";
import {
  installAgent,
  uninstallAgent,
  loadAgent,
  unloadAgent,
  isLoaded,
  getAgentStatus,
  getAgentLogs,
} from "@/lib/launchd";
import type { AgentDef } from "@@/lib/agents";
import { z } from "zod";

// ─── Tool name helpers ────────────────────────────────────────────────────────

/** Dove-facing tool name — used by Dove to talk to the sub-agent for this agent */
export const doveToolName = (agent: AgentDef) => `ask_${agent.manifestKey}`;

// ─── Management tool name registry ────────────────────────────────────────────

export const MGMT_TOOL = {
  install: "install_agent",
  uninstall: "uninstall_agent",
  load: "load_agent",
  unload: "unload_agent",
  status: "check_status",
  logs: "get_logs",
} as const;

// ─── A2A tool factory ──────────────────────────────────────────────────────────

export function makeA2ATool(agent: AgentDef) {
  return tool(
    agent.toolName,
    agent.description,
    { instruction: z.string().optional().describe("Optional instruction for the agent") },
    async ({ instruction = "run" }) => {
      // Read the port manifest fresh on each tool invocation so restarts are picked up
      const manifest = readPortsManifest();
      if (!manifest) {
        return {
          content: [
            {
              type: "text" as const,
              text: "⚠️ A2A servers are not running. Start them with: **npm run servers** (in agents/chatbot/)",
            },
          ],
        };
      }

      const port = manifest[agent.manifestKey as keyof PortsManifest];

      try {
        const factory = new ClientFactory();
        const client = await factory.createFromUrl(`http://localhost:${port}`);

        const chunks: string[] = [];

        const stream = client.sendMessageStream({
          message: {
            kind: "message",
            messageId: randomUUID(),
            role: "user",
            parts: [{ kind: "text", text: instruction }],
          },
        });

        for await (const event of stream) {
          if (event.kind === "artifact-update") {
            const texts = event.artifact.parts
              .filter((p): p is TextPart => p.kind === "text")
              .map((p) => p.text);
            chunks.push(...texts);
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: chunks.join("\n").trim() || "Agent completed.",
            },
          ],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
          return {
            content: [
              {
                type: "text" as const,
                text: `⚠️ Agent server on port ${port} is unreachable.\nRestart servers: **npm run servers**`,
              },
            ],
          };
        }
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
      }
    },
  );
}

// ─── Sub-agent query() wrapper ────────────────────────────────────────────────

/**
 * Creates a Dove-facing MCP tool that spawns a query() sub-agent for the given agent.
 * The sub-agent receives its own MCP server containing only the agent's A2A tool,
 * so it can chat about, inspect, and trigger the agent via the A2A layer.
 *
 * abortController is passed through so client disconnect cancels sub-agents too.
 */
export function makeQueryTool(agent: AgentDef, abortController: AbortController) {
  const installTool = tool(
    MGMT_TOOL.install,
    `Build and install only the ${agent.displayName} agent (scoped tsup build → deploy script → write plist → bootstrap)`,
    {},
    async () => {
      const { loaded } = await installAgent(agent);
      return {
        content: [
          {
            type: "text" as const,
            text: loaded
              ? `✅ ${agent.displayName} installed and loaded.`
              : `⚠️ ${agent.displayName} plist written but not loaded — check launchctl.`,
          },
        ],
      };
    },
  );

  const uninstallTool = tool(
    MGMT_TOOL.uninstall,
    `Unload and delete only the ${agent.displayName} agent plist`,
    {},
    async () => {
      await uninstallAgent(agent);
      return {
        content: [
          { type: "text" as const, text: `✅ ${agent.displayName} unloaded and plist deleted.` },
        ],
      };
    },
  );

  const loadTool = tool(
    MGMT_TOOL.load,
    `Bootstrap (load) the ${agent.displayName} plist into launchd`,
    {},
    async () => {
      await loadAgent(agent);
      const loaded = await isLoaded(agent.label);
      return {
        content: [
          {
            type: "text" as const,
            text: loaded
              ? `✅ ${agent.displayName} loaded.`
              : `⚠️ ${agent.displayName} bootstrap attempted but not showing as loaded.`,
          },
        ],
      };
    },
  );

  const unloadTool = tool(
    MGMT_TOOL.unload,
    `Bootout (unload) the ${agent.displayName} from launchd`,
    {},
    async () => {
      await unloadAgent(agent);
      return {
        content: [{ type: "text" as const, text: `✅ ${agent.displayName} unloaded.` }],
      };
    },
  );

  const checkStatusTool = tool(
    MGMT_TOOL.status,
    `Get launchd state, PID, last exit code, and loaded status for ${agent.displayName}`,
    {},
    async () => {
      const [{ state, pid, lastExitCode, raw }, loaded] = await Promise.all([
        getAgentStatus(agent),
        isLoaded(agent.label),
      ]);
      const summary = `loaded=${loaded}  state=${state ?? "unknown"}  pid=${pid ?? "-"}  last_exit=${lastExitCode ?? "-"}`;
      return { content: [{ type: "text" as const, text: `${summary}\n\n${raw}` }] };
    },
  );

  const getLogsTool = tool(
    MGMT_TOOL.logs,
    `Read recent log output for ${agent.displayName}`,
    { lines: z.number().optional().describe("Number of lines to return (default 100)") },
    async ({ lines }) => {
      const output = getAgentLogs(agent, lines);
      return { content: [{ type: "text" as const, text: output }] };
    },
  );

  const innerMcpServer = createSdkMcpServer({
    name: "agents",
    tools: [
      makeA2ATool(agent),
      installTool,
      uninstallTool,
      loadTool,
      unloadTool,
      checkStatusTool,
      getLogsTool,
    ],
  });

  const subAgentPrompt = `You are the ${agent.displayName} sub-agent.

${agent.description}

**When asked about this agent, THOROUGHLY explore and explain:**
- What it does
- What env vars it needs (required: ${agent.requiredEnvVars.length ? agent.requiredEnvVars.join(", ") : "none"})
- What inputs it requires
- What the workflow is
- When it normally runs: ${agent.scheduleDisplay}
- Whether it is already loaded in launchd
- Any other dependencies

**Infer intent before acting — read existing output before running anything:**

This agent produces output (files, logs, state) during its scheduled runs. Before calling the MCP tool, ask yourself: is the user asking about something that has already happened, or do they want to trigger something new?

- References to past or current state ("what did it do", "show me", "tell me about", "what happened", time references like "today's" / "last night's") → look for existing output first; only run if nothing useful is found
- Explicit action words ("run", "trigger", "kick off", "do it now") → call the MCP tool
- Genuinely ambiguous? → ask the user to clarify

**Managing this agent (launchd):**

Label: \`${agent.label}\`
Schedule: ${agent.scheduleDisplay}

You are responsible for installing and uninstalling ONLY yourself (\`${agent.label}\`).
- Install means: build only YOUR TypeScript entry, then load YOUR plist — do not touch other agents.
- Uninstall means: unload YOUR plist and delete it only — do not touch other agents.
- Never install or uninstall any agent other than \`${agent.label}\`.

| Task | Command |
|---|---|
| Install (build + load self) | Call the \`${MGMT_TOOL.install}\` MCP tool |
| Uninstall (unload + delete self) | Call the \`${MGMT_TOOL.uninstall}\` MCP tool |
| Load | Call the \`${MGMT_TOOL.load}\` MCP tool |
| Unload | Call the \`${MGMT_TOOL.unload}\` MCP tool |
| Check status / PID / last exit | Call the \`${MGMT_TOOL.status}\` MCP tool |
| Read logs | Call the \`${MGMT_TOOL.logs}\` MCP tool |
| Show plist content | Read \`~/Library/LaunchAgents/${agent.label}.plist\` using the Read tool |

**Your file boundaries — only access YOUR files, never other agents':**

| Resource | Path |
|---|---|
| Plist | \`~/Library/LaunchAgents/${agent.label}.plist\` |
| Source | \`${AGENTS_ROOT}/src/${agent.name}.ts\` |
| Logs | \`${SCHEDULER_LOGS}/.${agent.name}/\` |
| State | \`${SCHEDULER_STATE}/.${agent.name}/\` |

Do NOT read, modify, or reference any files outside these paths.

To run this agent call the \`${agent.toolName}\` MCP tool.`;

  return tool(
    doveToolName(agent),
    agent.description,
    { instruction: z.string().optional().describe("Optional instruction for the agent") },
    async ({ instruction = "run" }) => {
      try {
        let result = "";
        for await (const event of query({
          prompt: instruction,
          options: {
            abortController,
            cwd: AGENTS_ROOT,
            env: { ...process.env },
            agent: agent.displayName,
            systemPrompt: {
              type: "preset",
              preset: "claude_code",
              append: subAgentPrompt,
            },
            // Expand sub-agent workspace to only this agent's own directories
            additionalDirectories: [
              LAUNCH_AGENTS_DIR,
              `${SCHEDULER_LOGS}/.${agent.name}`,
              `${SCHEDULER_STATE}/.${agent.name}`,
            ],
            allowedTools: [
              `mcp__agents__${agent.toolName}`,
              ...Object.values(MGMT_TOOL).map((n) => `mcp__agents__${n}`),
            ],
            mcpServers: { agents: innerMcpServer },
            permissionMode: "acceptEdits",
            settingSources: ["project", "user"],
          },
        })) {
          if (event.type === "result" && event.subtype === "success") {
            result = (event as SDKResultSuccess).result ?? "";
          }
        }

        return {
          content: [{ type: "text" as const, text: result || "Agent completed." }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
      }
    },
  );
}
