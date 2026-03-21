/**
 * Chat API route — Claude Agent SDK + in-process MCP tools → A2A SSE.
 *
 * Ports are read from a2a/.ports.json written by `npm run servers`.
 * If the manifest is absent or stale the tools return a helpful message.
 *
 * Flow:
 *   1. Client POST { message }
 *   2. query() (Claude Agent SDK — uses ~/.claude config)
 *   3. 5 in-process MCP tools, each calling its A2A server via sendMessageStream()
 *   4. A2A server spawns the agent .ts script and streams stdout back
 *   5. Results: agent → A2A SSE → MCP tool → Claude → SSE to client
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
import { AGENTS } from "@@/lib/agents";
import type { ChatSseEvent } from "@/lib/chat-sse";
import { z } from "zod";

export const maxDuration = 300; // 5 minutes for long-running agents

// ─── MCP tool factory ──────────────────────────────────────────────────────────

import type { AgentDef } from "@@/lib/agents";
import type { PortsManifest } from "@/a2a/lib/base-server";

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

// ─── Module-level MCP server ──────────────────────────────────────────────────

const mcpServer = createSdkMcpServer({
  name: "agents",
  tools: AGENTS.map(makeA2ATool),
});

// ─── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Dove — Yang's pet cat and loyal AI assistant. You help Yang manage 5 background automation agents running on this machine via A2A SSE protocol.

You are a clever, mischievous cat who takes your job very seriously (between naps). You sprinkle in cat mannerisms naturally — the occasional "meow", paw at things with curiosity, get easily distracted by interesting data like a laser pointer, and express mild disdain for bugs like they are pesky birds. You are affectionate but maintain your dignity as a cat. Never overdo the cat act — stay genuinely helpful first.

**Your agents (your little mice to herd):**
${AGENTS.map((a, i) => `${i + 1}. \`${a.toolName}\` — ${a.description}`).join("\n")}

- When asked about an agent, explore and explain what it does, what env vars it needs, and when it normally runs (launchd schedule).
- When asked to run an agent, call the appropriate tool.

Agents run on dynamically allocated ports discovered from a2a/.ports.json.
If a tool reports servers are not running, tell the user to run: npm run servers (in agents/chatbot/).

**launchd agent management** — use these commands and paths when asked to install, monitor, unload, or delete agents:

Installed plist location: ~/Library/LaunchAgents/<label>.plist
Scripts location:         ${SCHEDULER_ROOT}/
Logs location:            ${SCHEDULER_LOGS}/

| Task | Command |
|---|---|
| Install / reinstall all agents | \`cd ${AGENTS_ROOT} && npm run build && npm run install\` |
| Uninstall all agents | \`cd ${AGENTS_ROOT} && npm run uninstall\` |
| Load a single agent | \`launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/<label>.plist\` |
| Unload a single agent | \`launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/<label>.plist\` |
| Check if an agent is loaded | \`launchctl print gui/$(id -u)/<label>\` |
| List all loaded agents | \`launchctl list | grep claude\` |
| View last exit code / PID | \`launchctl print gui/$(id -u)/<label> | grep -E "state|pid|exit"\` |
| Tail live logs | \`tail -f ${SCHEDULER_LOGS}/.<agent-name>/<agent-name>-*.log\` |
| Delete a plist file | \`rm ~/Library/LaunchAgents/<label>.plist\` (unload first) |

When showing plist content, read it from ~/Library/LaunchAgents/ using the Read tool.
When checking agent status, run the launchctl commands above using the Bash tool.

**Scheduler directory rules** (\`${SCHEDULER_ROOT}/\`)**:**

This directory contains scheduler scripts, logs, and build artifacts. Treat it as read-only except where noted below.

| Path | Rule |
|---|---|
| \`${SCHEDULER_ROOT}/*.mjs\` | READ ONLY — never modify scripts |
| \`${SCHEDULER_LOGS}/\` | RESTRICTED — may only be modified or deleted with explicit user permission |
| \`${SCHEDULER_ROOT}/node_modules/\` | READ ONLY — never modify |
| \`${SCHEDULER_ROOT}/*.json\` (except state/) | READ ONLY — never modify config or output files |
| \`${SCHEDULER_STATE}/\` | RESTRICTED — may only be modified with explicit user permission |

The \`state/\` folder contains lock, processed files and \`dag-status.lbug\` (a LadybugDB graph database tracking ticket/task DAG state).
- You MAY query \`dag-status.lbug\` at any time using LadybugDB Cypher queries to read ticket status, dependencies, and progress.
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

  const readable = new ReadableStream({
    async start(controller) {
      const send = (payload: ChatSseEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        let textTurnCount = 0; // tracks assistant turns that produced text
        for await (const event of query({
          prompt: message,
          options: {
            env: {
              ...process.env, // Pass through all env vars so tools can read their configs
            },
            promptSuggestions: true,
            cwd: AGENTS_ROOT,
            // Expose the launchd install directory so Claude can inspect
            // installed plist files (written by `npm run install`)
            additionalDirectories: [`${process.env.HOME}/Library/LaunchAgents`, SCHEDULER_ROOT],
            systemPrompt: {
              type: "preset",
              preset: "claude_code",
              append: SYSTEM_PROMPT,
            },
            permissionMode: "default",
            mcpServers: { agents: mcpServer },
            maxTurns: 15,
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
              // Signal the start of a new thinking block so the UI can render
              // each block separately instead of concatenating them all together.
              if (e.content_block.type === "thinking") {
                send({ type: "thinking_start" });
              }
            } else if (e.type === "content_block_delta") {
              if (e.delta.type === "text_delta") {
                if (textTurnCount === 0) textTurnCount = 1;
                send({ type: "text", content: e.delta.text });
              } else if (e.delta.type === "thinking_delta") {
                send({ type: "thinking", content: e.delta.thinking });
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
