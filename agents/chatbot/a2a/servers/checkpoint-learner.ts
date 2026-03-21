import { join } from "node:path";
import type { AgentCard } from "@a2a-js/sdk";
import { AGENTS_ROOT, ScriptAgentExecutor, createAgentServer } from "../lib/base-server.js";

const agentCard: Omit<AgentCard, "url" | "additionalInterfaces"> = {
  name: "Checkpoint Learner",
  description:
    "Extracts domain knowledge and user preferences from Claude Code checkpoint sessions " +
    "into project-level MEMORY.md files. Runs across all configured repositories and " +
    "deduplicates against existing memories.",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  skills: [
    {
      id: "extract-checkpoint-knowledge",
      name: "Extract Checkpoint Knowledge",
      description:
        "Scans CHECKPOINT_REPOS for unprocessed Claude Code checkpoint sessions " +
        "and writes new learnings to ~/.claude/projects/<slug>/memory/.",
      tags: ["memory", "learning", "checkpoints", "claude-code"],
    },
  ],
  capabilities: { streaming: true, pushNotifications: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

const executor = new ScriptAgentExecutor({
  scriptPath: join(AGENTS_ROOT, "src/checkpoint-learner.ts"),
  agentName: "Checkpoint Learner",
  requiredEnvVars: ["CHECKPOINT_REPOS"],
  whatItDoes:
    "scans git branches for unprocessed checkpoint sessions and writes domain knowledge to project memory files",
});

/** Called by start-all.ts with a dynamically allocated port. */
export function startServer(port: number): void {
  createAgentServer(agentCard as AgentCard, executor, port);
}
