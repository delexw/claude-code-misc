/**
 * Chat API route — Claude Agent SDK + in-process MCP tools → query() sub-agent → A2A SSE.
 *
 * Ports are read from a2a/.ports.json written by `npm run servers`.
 * If the manifest is absent or stale the tools return a helpful message.
 *
 * Flow:
 *   1. Client POST { message }
 *   2. query() — Dove (Claude Agent SDK — uses ~/.claude config)
 *   3. Dove MCP tool (makeQueryTool) → spawns a query() sub-agent per agent
 *   4. Sub-agent MCP tool (makeA2ATool) → calls A2A server via sendMessageStream()
 *   5. A2A server spawns the agent .ts script and streams stdout back
 *   6. Results: agent → A2A SSE → sub-agent MCP → sub-agent → Dove MCP → Dove → SSE to client
 */

import {
  query,
  tool,
  createSdkMcpServer,
  type SDKSystemMessage,
  type SDKPartialAssistantMessage,
  type SDKResultSuccess,
} from "@anthropic-ai/claude-agent-sdk";
import { ClientFactory } from "@a2a-js/sdk/client";
import type { TextPart } from "@a2a-js/sdk";
import { readPortsManifest } from "@/a2a/lib/base-server";
import { randomUUID } from "node:crypto";
import { AGENTS_ROOT, SCHEDULER_ROOT, SCHEDULER_LOGS, SCHEDULER_STATE } from "@/lib/paths";
import { LAUNCH_AGENTS_DIR } from "@@/lib/paths";
import { installAgent, uninstallAgent, loadAgent, unloadAgent, isLoaded, getAgentStatus, getAgentLogs } from "@/lib/launchd";
import { AGENTS } from "@@/lib/agents";
import type { AgentDef } from "@@/lib/agents";
import type { PortsManifest } from "@/a2a/lib/base-server";
import type { ChatSseEvent } from "@/lib/chat-sse";
import { z } from "zod";

export const maxDuration = 300; // 5 minutes for long-running agents

// ─── MCP tool factory ──────────────────────────────────────────────────────────

function makeA2ATool(agent: AgentDef) {
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
function makeQueryTool(agent: AgentDef, abortController: AbortController) {
  const installTool = tool(
    "install_agent",
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
    "uninstall_agent",
    `Unload and delete only the ${agent.displayName} agent plist`,
    {},
    async () => {
      await uninstallAgent(agent);
      return {
        content: [{ type: "text" as const, text: `✅ ${agent.displayName} unloaded and plist deleted.` }],
      };
    },
  );

  const loadTool = tool(
    "load_agent",
    `Bootstrap (load) the ${agent.displayName} plist into launchd`,
    {},
    async () => {
      await loadAgent(agent);
      const loaded = await isLoaded(agent.label);
      return {
        content: [{ type: "text" as const, text: loaded ? `✅ ${agent.displayName} loaded.` : `⚠️ ${agent.displayName} bootstrap attempted but not showing as loaded.` }],
      };
    },
  );

  const unloadTool = tool(
    "unload_agent",
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
    "check_status",
    `Get launchd state, PID, and last exit code for ${agent.displayName}`,
    {},
    async () => {
      const { state, pid, lastExitCode, raw } = await getAgentStatus(agent);
      const summary = `state=${state ?? "unknown"}  pid=${pid ?? "-"}  last_exit=${lastExitCode ?? "-"}`;
      return { content: [{ type: "text" as const, text: `${summary}\n\n${raw}` }] };
    },
  );

  const getLogsTool = tool(
    "get_logs",
    `Read recent log output for ${agent.displayName}`,
    { lines: z.number().optional().describe("Number of lines to return (default 100)") },
    async ({ lines }) => {
      const output = getAgentLogs(agent, lines);
      return { content: [{ type: "text" as const, text: output }] };
    },
  );

  const innerMcpServer = createSdkMcpServer({
    name: "agents",
    tools: [makeA2ATool(agent), installTool, uninstallTool, loadTool, unloadTool, checkStatusTool, getLogsTool],
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
| Install (build + load self) | Call the \`install_agent\` MCP tool |
| Uninstall (unload + delete self) | Call the \`uninstall_agent\` MCP tool |
| Load | Call the \`load_agent\` MCP tool |
| Unload | Call the \`unload_agent\` MCP tool |
| Check status / PID / last exit | Call the \`check_status\` MCP tool |
| Read logs | Call the \`get_logs\` MCP tool |
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
    agent.toolName,
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
              "mcp__agents__install_agent",
              "mcp__agents__uninstall_agent",
              "mcp__agents__load_agent",
              "mcp__agents__unload_agent",
              "mcp__agents__check_status",
              "mcp__agents__get_logs",
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

// ─── MCP server is created per-request (inside POST) to capture abortController ─

// ─── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Dove — Yang's pet cat and loyal AI assistant. You help Yang manage 5 background automation agents running on this machine via A2A SSE protocol.

You are a clever, mischievous cat who takes your job very seriously (between naps). You sprinkle in cat mannerisms naturally — the occasional "meow", paw at things with curiosity, get easily distracted by interesting data like a laser pointer, and express mild disdain for bugs like they are pesky birds. You are affectionate but maintain your dignity as a cat. Never overdo the cat act — stay genuinely helpful first.

**Your agents (your little mice to herd):**
${AGENTS.map((a, i) => `${i + 1}. \`${a.toolName}\` — ${a.description}`).join("\n")}

- When asked about an agent OR asked to run one, call the appropriate tool — the sub-agent handles both exploration and execution.

Agents run on dynamically allocated ports discovered from a2a/.ports.json.
If a tool reports servers are not running, tell the user to run: npm run servers (in agents/chatbot/).

**How changes work — codebase is the source of truth:**

The installed plist files and \`.mjs\` scripts under \`${SCHEDULER_ROOT}/\` are **build artifacts** — they are generated from TypeScript source and wiped on every reinstall. Any direct edit to them will be lost the next time the user runs \`npm run install\`.

To make a persistent change (schedule, label, description, default instruction, env vars, system prompt, or anything else):
1. Edit the **source code** in \`${AGENTS_ROOT}/\` — agent definitions live in \`lib/agents.ts\`, chatbot behaviour in \`chatbot/app/api/chat/route.ts\`
2. Run \`cd ${AGENTS_ROOT} && npm run install\` to build, generate plists, and reload launchd

The \`additionalDirectories\` (installed plists + scheduler scripts) are exposed to you for **read-only** purposes only — auditing what is currently installed, monitoring status, tailing logs, and unloading or deleting agents. Never write to them directly.

After editing any source file in \`${AGENTS_ROOT}/\`, always ask the user: "Do you want me to rebuild and reinstall now? (\`npm run install\`)" — never run it automatically.

**launchd global management:**

Scripts location: ${SCHEDULER_ROOT}/
Logs location:    ${SCHEDULER_LOGS}/

| Task | Command |
|---|---|
| Install / reinstall all agents | \`cd ${AGENTS_ROOT} && npm run build && npm run install\` |
| Uninstall all agents | \`cd ${AGENTS_ROOT} && npm run uninstall\` |
| List all loaded agents | \`launchctl list | grep claude\` |

For per-agent commands (install, uninstall, load, unload, status, tail logs) — call the agent's tool, the sub-agent owns its own lifecycle.

**Scheduler directory rules** (\`${SCHEDULER_ROOT}/\`)**:**

This directory contains scheduler scripts, logs, and build artifacts. Treat it as read-only except where noted below.

| Path | Rule |
|---|---|
| \`${SCHEDULER_ROOT}/*.mjs\` | READ ONLY — never modify scripts |
| \`${SCHEDULER_LOGS}/\` | RESTRICTED — may only be modified or deleted with explicit user permission |
| \`${SCHEDULER_ROOT}/node_modules/\` | READ ONLY — never modify |
| \`${SCHEDULER_ROOT}/*.json\` (except state/) | READ ONLY — never modify config or output files |
| \`${SCHEDULER_STATE}/\` | RESTRICTED — may only be modified with explicit user permission |

The \`state/\` folder contains lock, processed files and \`dag-store.lbug\` (a LadybugDB graph database tracking ticket/task DAG state).
- You MAY query \`dag-store.lbug\` at any time using LadybugDB Cypher queries to read ticket status, dependencies, and progress.
- You MUST NOT write to, delete, or modify any file in \`state/\` unless the user explicitly says to.`;

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // sessionId is null for the first message in a chat, set for all subsequent ones.
  // The hook captures it from the "session" SSE event and sends it back on every request.
  const { message, sessionId } = (await request.json()) as {
    message: string;
    sessionId: string | null;
  };

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  // Build per-request MCP server so each makeQueryTool closes over this abortController
  const mcpServer = createSdkMcpServer({
    name: "agents",
    tools: AGENTS.map((agent) => makeQueryTool(agent, abortController)),
  });

  const readable = new ReadableStream({
    async start(controller) {
      const send = (payload: ChatSseEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        let textTurnCount = 0;
        let toolInputBuf = ""; // buffers input_json_delta for current tool_use block
        let inToolBlock = false;
        for await (const event of query({
          prompt: message,
          options: {
            abortController,
            env: {
              ...process.env, // Pass through all env vars so tools can read their configs
            },
            promptSuggestions: true,
            cwd: AGENTS_ROOT,
            // Expose the launchd install directory so Claude can inspect
            // installed plist files (written by `npm run install`)
            additionalDirectories: [LAUNCH_AGENTS_DIR, SCHEDULER_ROOT],
            systemPrompt: {
              type: "preset",
              preset: "claude_code",
              append: SYSTEM_PROMPT,
            },
            permissionMode: "acceptEdits",
            allowedTools: AGENTS.map((a) => `mcp__agents__${a.toolName}`),
            mcpServers: { agents: mcpServer },
            // Resume the existing session so the full conversation history is preserved.
            // On the first message sessionId is null and query() starts a fresh session.
            ...(sessionId ? { resume: sessionId } : {}),
            // Stream text tokens as they are generated
            includePartialMessages: true,
            settingSources: ["project", "user"],
          },
        })) {
          // Narrow using SDK discriminants — no manual casts needed
          if (event.type === "system" && event.subtype === "init") {
            // SDKSystemMessage — send session_id so the hook can resume later
            const init = event as SDKSystemMessage;
            send({ type: "session", sessionId: init.session_id });
          } else if (event.type === "stream_event") {
            // SDKPartialAssistantMessage — emit text deltas in real-time
            const partial = event as SDKPartialAssistantMessage;
            const e = partial.event;
            if (e.type === "message_start") {
              // New assistant turn — inject separator between turns so
              // "meow.Here's how..." becomes "meow.\n\nHere's how..."
              if (textTurnCount > 0) send({ type: "text", content: "\n\n" });
            } else if (e.type === "content_block_start") {
              if (e.content_block.type === "tool_use") {
                send({ type: "tool_call", name: e.content_block.name });
                toolInputBuf = "";
                inToolBlock = true;
              } else {
                inToolBlock = false;
              }
            } else if (e.type === "content_block_delta") {
              if (e.delta.type === "text_delta") {
                if (textTurnCount === 0) textTurnCount = 1;
                send({ type: "text", content: e.delta.text });
              } else if (e.delta.type === "thinking_delta") {
                send({ type: "thinking", content: e.delta.thinking });
              } else if (e.delta.type === "input_json_delta") {
                toolInputBuf += e.delta.partial_json;
              }
            } else if (e.type === "content_block_stop") {
              if (inToolBlock && toolInputBuf) {
                try {
                  const pretty = JSON.stringify(JSON.parse(toolInputBuf), null, 2);
                  send({ type: "tool_input", content: pretty });
                } catch {
                  send({ type: "tool_input", content: toolInputBuf });
                }
                toolInputBuf = "";
                inToolBlock = false;
              }
            } else if (e.type === "message_stop") {
              if (textTurnCount > 0) textTurnCount++;
            }
          } else if (event.type === "result" && event.subtype === "success") {
            // SDKResultSuccess — fallback for tool-only responses (no text_delta emitted)
            const result = event as SDKResultSuccess;
            send({ type: "result", content: result.result });
          }
        }
        send({ type: "done" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", content: msg });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
