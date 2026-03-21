import { join } from "node:path";
import type { AgentCard } from "@a2a-js/sdk";
import { ScriptAgentExecutor, createAgentServer } from "../lib/base-server.js";
import { AGENTS_ROOT } from "@/lib/paths";
import { AGENTS } from "@@/lib/agents";

const def = AGENTS.find((a) => a.name === "oncall-analyzer")!;

const agentCard: Omit<AgentCard, "url" | "additionalInterfaces"> = {
  name: def.displayName,
  description: def.description,
  protocolVersion: "0.3.0",
  version: "1.0.0",
  skills: [],
  capabilities: { streaming: true, pushNotifications: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

const executor = new ScriptAgentExecutor({
  scriptPath: join(AGENTS_ROOT, "src/oncall-analyzer.ts"),
  agentName: def.displayName,
  requiredEnvVars: def.requiredEnvVars,
  whatItDoes: def.description,
});

export function startServer(port: number): void {
  createAgentServer(agentCard as AgentCard, executor, port);
}
