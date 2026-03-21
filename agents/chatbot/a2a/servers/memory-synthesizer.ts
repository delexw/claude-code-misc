import { join } from "node:path";
import type { AgentCard } from "@a2a-js/sdk";
import { AGENTS_ROOT, ScriptAgentExecutor, createAgentServer } from "../lib/base-server.js";

const agentCard: Omit<AgentCard, "url" | "additionalInterfaces"> = {
  name: "Memory Synthesizer",
  description:
    "Analyzes all project-level MEMORY.md files across configured repositories and " +
    "promotes patterns that appear in 2+ projects into the global ~/.claude/CLAUDE.md. " +
    "Removes promoted entries from project files to avoid duplication.",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  skills: [
    {
      id: "synthesize-memories",
      name: "Synthesize Cross-Project Memories",
      description:
        "Reads project-level MEMORY.md files, identifies patterns appearing across 2+ " +
        "projects, promotes them to the global CLAUDE.md, and cleans up project files.",
      tags: ["memory", "synthesis", "claude-md", "preferences", "patterns"],
    },
  ],
  capabilities: { streaming: true, pushNotifications: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

const executor = new ScriptAgentExecutor({
  scriptPath: join(AGENTS_ROOT, "src/memory-synthesizer.ts"),
  agentName: "Memory Synthesizer",
  requiredEnvVars: ["MEMORY_REPOS"],
  whatItDoes:
    "synthesizes cross-project patterns into ~/.claude/CLAUDE.md and removes them from project memory files",
});

export function startServer(port: number): void {
  createAgentServer(agentCard as AgentCard, executor, port);
}
