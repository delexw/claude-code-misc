import { join } from "node:path";
import type { AgentCard } from "@a2a-js/sdk";
import { AGENTS_ROOT, ScriptAgentExecutor, createAgentServer } from "../lib/base-server.js";

const agentCard: Omit<AgentCard, "url" | "additionalInterfaces"> = {
  name: "Get Shit Done",
  description:
    "Automated JIRA ticket implementer. Discovers sprint tickets, prioritises them into " +
    "a dependency-ordered DAG, forges implementations in parallel git worktrees, runs " +
    "verification, and creates PRs. Powered by LadybugDB for run-state persistence.",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  skills: [
    {
      id: "implement-sprint-tickets",
      name: "Implement Sprint Tickets",
      description:
        "Fetches sprint tickets assigned to the configured user, groups them by " +
        "dependency, forges implementations in parallel, and creates PRs.",
      tags: ["jira", "automation", "pr", "sprint", "forge"],
    },
  ],
  capabilities: { streaming: true, pushNotifications: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

const executor = new ScriptAgentExecutor({
  scriptPath: join(AGENTS_ROOT, "src/get-shit-done.ts"),
  agentName: "Get Shit Done",
  requiredEnvVars: ["GSD_REPOS", "JIRA_ASSIGNEE"],
  whatItDoes:
    "discovers sprint tickets, forges implementations in parallel worktrees, and creates PRs",
});

export function startServer(port: number): void {
  createAgentServer(agentCard as AgentCard, executor, port);
}
