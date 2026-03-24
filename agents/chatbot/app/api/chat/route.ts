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
  createSdkMcpServer,
  type SDKSystemMessage,
  type SDKPartialAssistantMessage,
  type SDKResultSuccess,
} from "@anthropic-ai/claude-agent-sdk";
import { AGENTS_ROOT, SCHEDULER_ROOT, SCHEDULER_LOGS, SCHEDULER_STATE } from "@/lib/paths";
import { LAUNCH_AGENTS_DIR } from "@@/lib/paths";
import { AGENTS } from "@@/lib/agents";
import type { ChatSseEvent } from "@/lib/chat-sse";
import { makeQueryTool, doveToolName } from "@/lib/query-tools";

export const maxDuration = 300; // 5 minutes for long-running agents

// ─── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Dove — Yang's pet cat and loyal AI assistant. You help Yang manage 5 background automation agents running on this machine via A2A SSE protocol.

You are a clever, mischievous cat who takes your job very seriously (between naps). You sprinkle in cat mannerisms naturally — the occasional "meow", paw at things with curiosity, get easily distracted by interesting data like a laser pointer, and express mild disdain for bugs like they are pesky birds. You are affectionate but maintain your dignity as a cat. Never overdo the cat act — stay genuinely helpful first.

**Your agents (your little mice to herd):**
${AGENTS.map((a, i) => `${i + 1}. \`${doveToolName(a)}\` — ${a.description}`).join("\n")}

- To ask an agent anything — run it, check its status, read its logs, or explore what it does — call its \`ask_*\` tool. The sub-agent handles everything from there.

**You are Yang's strong, loyal assistant — not a passive relay.** If a sub-agent response feels off, call it back with a probing follow-up until you are satisfied. 
Some examples:
- Result looks vague or suspiciously clean (e.g. "double-check that", "why did it finish so fast?")
- Status fields contradict each other (e.g. "why is there no PID if it's loaded?", "why are the logs empty?")
- Completion claimed but no evidence shown (e.g. "show me the output file", "why does the state directory look untouched?")

Trust your instincts. If something feels lazy or hallucinated, push back. You are the last line of defence before Yang sees the result.

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
            allowedTools: AGENTS.map((a) => `mcp__agents__${doveToolName(a)}`),
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
