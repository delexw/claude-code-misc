import { join } from "node:path";
import type { AgentCard } from "@a2a-js/sdk";
import { ScriptAgentExecutor, createAgentServer } from "../lib/base-server.js";
import { AGENTS_ROOT } from "@/lib/paths";

const agentCard: Omit<AgentCard, "url" | "additionalInterfaces"> = {
  name: "Oncall Analyzer",
  description:
    "Daily Post Incident Record (PIR) generator. Fetches PagerDuty incidents from the " +
    "past 24 hours, correlates with Datadog metrics, Cloudflare traffic data, and Rollbar " +
    "errors, then generates structured PIR documents.",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  skills: [
    {
      id: "generate-pir",
      name: "Generate Post Incident Record",
      description:
        "Analyses PagerDuty incidents from the configured time window, correlates with " +
        "observability data, and produces a PIR report via the /pir skill.",
      tags: ["pagerduty", "incident", "pir", "observability", "oncall"],
    },
  ],
  capabilities: { streaming: true, pushNotifications: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

const executor = new ScriptAgentExecutor({
  scriptPath: join(AGENTS_ROOT, "src/oncall-analyzer.ts"),
  agentName: "Oncall Analyzer",
  requiredEnvVars: ["PIR_REPOS", "PIR_DOMAIN"],
  whatItDoes: "generates Post Incident Records from PagerDuty incidents over the past 24 hours",
});

export function startServer(port: number): void {
  createAgentServer(agentCard as AgentCard, executor, port);
}
