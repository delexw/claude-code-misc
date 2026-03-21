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

import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { ClientFactory } from "@a2a-js/sdk/client";
import type { TextPart } from "@a2a-js/sdk";
import { readPortsManifest } from "@/a2a/lib/base-server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const maxDuration = 300; // 5 minutes for long-running agents

// ─── Agent definitions (name + manifest key + description) ───────────────────

const AGENTS = [
  {
    toolName: "run_checkpoint_learner",
    manifestKey: "checkpoint_learner" as const,
    description:
      "Extract domain knowledge from Claude Code checkpoint sessions into project MEMORY.md files. " +
      "Requires CHECKPOINT_REPOS env var.",
  },
  {
    toolName: "run_get_shit_done",
    manifestKey: "get_shit_done" as const,
    description:
      "Automated JIRA ticket implementer: discovers sprint tickets, forges implementations in " +
      "parallel git worktrees, and creates PRs. Requires GSD_REPOS + JIRA_ASSIGNEE env vars.",
  },
  {
    toolName: "run_jsonl_compat_checker",
    manifestKey: "jsonl_compat_checker" as const,
    description:
      "Monitor Claude Code releases for JSONL format changes that could break tail-claude-gui. " +
      "Creates GitHub issues for new breaking changes. Requires gh CLI authentication.",
  },
  {
    toolName: "run_memory_synthesizer",
    manifestKey: "memory_synthesizer" as const,
    description:
      "Synthesise cross-project memory patterns into the global ~/.claude/CLAUDE.md. " +
      "Requires MEMORY_REPOS env var listing ≥2 project paths.",
  },
  {
    toolName: "run_pir_analyzer",
    manifestKey: "pir_analyzer" as const,
    description:
      "Generate a Post Incident Record from PagerDuty incidents in the past 24 hours. " +
      "Requires PIR_REPOS + PIR_DOMAIN env vars.",
  },
] as const;

// ─── MCP tool factory ──────────────────────────────────────────────────────────

function makeA2ATool(agent: (typeof AGENTS)[number]) {
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

      const port = manifest[agent.manifestKey];

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

const SYSTEM_PROMPT = `You are an AI orchestrator for 5 background automation agents running on this machine via A2A SSE protocol.

**Available agents (tools):**
1. \`run_checkpoint_learner\` — Extracts domain knowledge from Claude Code checkpoint sessions into project memory files.
2. \`run_get_shit_done\` — Automated JIRA ticket implementer: parallel worktree forging + PR creation.
3. \`run_jsonl_compat_checker\` — Monitors Claude Code releases for JSONL format breaking changes.
4. \`run_memory_synthesizer\` — Promotes cross-project memory patterns into ~/.claude/CLAUDE.md.
5. \`run_pir_analyzer\` — Generates Post Incident Records from PagerDuty incidents.

When asked about an agent, explain what it does, what env vars it needs, and when it normally runs (launchd schedule).
When asked to run an agent, call the appropriate tool.
Agents run on dynamically allocated ports discovered from a2a/.ports.json.
If a tool reports servers are not running, tell the user to run: npm run servers (in agents/chatbot/).`;

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { message } = (await request.json()) as { message: string };

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        for await (const event of query({
          prompt: message,
          options: {
            systemPrompt: SYSTEM_PROMPT,
            mcpServers: { agents: mcpServer },
            maxTurns: 15,
          },
        })) {
          if ("result" in event) {
            send({ type: "result", content: event.result });
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
