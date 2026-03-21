import { join } from "node:path";
import type { AgentCard } from "@a2a-js/sdk";
import { AGENTS_ROOT, ScriptAgentExecutor, createAgentServer } from "../lib/base-server.js";

const agentCard: Omit<AgentCard, "url" | "additionalInterfaces"> = {
  name: "JSONL Compat Checker",
  description:
    "Monitors Claude Code releases for JSONL transcription format changes that could " +
    "break tail-claude-gui. Fetches release notes via Claude CLI, analyses for breaking " +
    "changes, deduplicates against existing GitHub issues, and creates issues for new findings.",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  skills: [
    {
      id: "check-jsonl-compat",
      name: "Check JSONL Compatibility",
      description:
        "Fetches recent Claude Code release notes and scans for JSONL entry schema " +
        "changes. Creates GitHub issues on delexw/tail-claude-gui for breaking changes.",
      tags: ["compatibility", "jsonl", "claude-code", "github", "monitoring"],
    },
  ],
  capabilities: { streaming: true, pushNotifications: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

const executor = new ScriptAgentExecutor({
  scriptPath: join(AGENTS_ROOT, "src/jsonl-compat-checker.ts"),
  agentName: "JSONL Compat Checker",
  requiredEnvVars: [],
  whatItDoes:
    "fetches Claude Code release notes and creates GitHub issues for JSONL format breaking changes",
});

export function startServer(port: number): void {
  createAgentServer(agentCard as AgentCard, executor, port);
}
