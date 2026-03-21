/**
 * Shared A2A server factory, port utilities, and script-spawning executor.
 *
 * Dynamic ports: call `getAvailablePort()` to let the OS assign a free port
 * (uses net.createServer with port 0 — no external deps).
 *
 * Port manifest: `start-all.ts` writes `a2a/.ports.json` after all servers
 * start; the Next.js API route reads it at request time.
 */

import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { consola } from "consola";
import express from "express";
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import type { AgentCard } from "@a2a-js/sdk";
import type { AgentExecutor, RequestContext, ExecutionEventBus } from "@a2a-js/sdk/server";
import type { AgentDef } from "@@/lib/agents";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import {
  agentCardHandler,
  jsonRpcHandler,
  restHandler,
  UserBuilder,
} from "@a2a-js/sdk/server/express";
import { AGENTS_ROOT, TSX_BIN, PORTS_FILE } from "@/lib/paths";

// ─── Port utilities ───────────────────────────────────────────────────────────

/**
 * Ask the OS for a free TCP port by binding a temporary server to port 0.
 * Built-in Node.js `net` module — no external dependencies.
 */
export function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export interface PortsManifest {
  experience_reflector: number;
  get_shit_done: number;
  release_log_sentinel: number;
  memory_distiller: number;
  oncall_analyzer: number;
  updatedAt: string;
}

export function writePortsManifest(ports: Omit<PortsManifest, "updatedAt">): void {
  const manifest: PortsManifest = { ...ports, updatedAt: new Date().toISOString() };
  writeFileSync(PORTS_FILE, JSON.stringify(manifest, null, 2));
}

export function readPortsManifest(): PortsManifest | null {
  if (!existsSync(PORTS_FILE)) return null;
  try {
    return JSON.parse(readFileSync(PORTS_FILE, "utf-8")) as PortsManifest;
  } catch {
    return null;
  }
}

// ─── Script-spawning executor ─────────────────────────────────────────────────

export interface AgentConfig {
  scriptPath: string;
  agentName: string;
  requiredEnvVars: string[];
  whatItDoes: string;
}

export class ScriptAgentExecutor implements AgentExecutor {
  constructor(private readonly config: AgentConfig) {}

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { taskId, contextId } = requestContext;

    const missing = this.config.requiredEnvVars.filter((v) => !process.env[v]);

    if (missing.length > 0) {
      eventBus.publish({
        kind: "artifact-update",
        taskId,
        contextId,
        artifact: {
          artifactId: randomUUID(),
          name: "config-info",
          parts: [
            {
              kind: "text",
              text: [
                `⚠️  **${this.config.agentName}** is not configured.`,
                ``,
                `Missing env vars: \`${missing.join("`, `")}\``,
                ``,
                `Once set, the agent will: ${this.config.whatItDoes}`,
                `Script: \`${this.config.scriptPath}\``,
              ].join("\n"),
            },
          ],
        },
      });
      eventBus.publish({
        kind: "status-update",
        taskId,
        contextId,
        status: { state: "completed", timestamp: new Date().toISOString() },
        final: true,
      });
      eventBus.finished();
      return;
    }

    if (!existsSync(this.config.scriptPath)) {
      eventBus.publish({
        kind: "artifact-update",
        taskId,
        contextId,
        artifact: {
          artifactId: randomUUID(),
          name: "error",
          parts: [{ kind: "text", text: `Script not found: ${this.config.scriptPath}` }],
        },
      });
      eventBus.publish({
        kind: "status-update",
        taskId,
        contextId,
        status: { state: "failed", timestamp: new Date().toISOString() },
        final: true,
      });
      eventBus.finished();
      return;
    }

    consola.start(`Running ${this.config.agentName}…`);

    eventBus.publish({
      kind: "status-update",
      taskId,
      contextId,
      status: { state: "working", timestamp: new Date().toISOString() },
      final: false,
    });

    const tsxBin = existsSync(TSX_BIN) ? TSX_BIN : "tsx";
    const proc = spawn(tsxBin, [this.config.scriptPath], {
      env: process.env,
      cwd: AGENTS_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const outputLines: string[] = [];

    const handleLine = (line: string) => {
      if (!line.trim()) return;
      outputLines.push(line);
      eventBus.publish({
        kind: "artifact-update",
        taskId,
        contextId,
        artifact: {
          artifactId: randomUUID(),
          name: "stdout",
          parts: [{ kind: "text", text: line.trim() }],
        },
      });
    };

    let stdoutBuf = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      lines.forEach(handleLine);
    });

    let stderrBuf = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      lines.forEach((l) => handleLine(`[stderr] ${l}`));
    });

    await new Promise<void>((resolve) => {
      proc.on("close", (code) => {
        if (stdoutBuf.trim()) handleLine(stdoutBuf);
        if (stderrBuf.trim()) handleLine(`[stderr] ${stderrBuf}`);

        if (code === 0) {
          consola.success(`${this.config.agentName} completed`);
        } else {
          consola.error(`${this.config.agentName} exited with code ${code ?? "?"}`);
        }

        const summary =
          outputLines.length > 0
            ? outputLines.join("\n")
            : `${this.config.agentName} finished (exit code ${code ?? "?"}).`;

        eventBus.publish({
          kind: "artifact-update",
          taskId,
          contextId,
          artifact: {
            artifactId: randomUUID(),
            name: "final-output",
            parts: [{ kind: "text", text: summary }],
          },
        });
        eventBus.publish({
          kind: "status-update",
          taskId,
          contextId,
          status: {
            state: code === 0 ? "completed" : "failed",
            timestamp: new Date().toISOString(),
          },
          final: true,
        });
        eventBus.finished();
        resolve();
      });

      proc.on("error", (err) => {
        eventBus.publish({
          kind: "artifact-update",
          taskId,
          contextId,
          artifact: {
            artifactId: randomUUID(),
            name: "error",
            parts: [{ kind: "text", text: `Spawn error: ${err.message}` }],
          },
        });
        eventBus.publish({
          kind: "status-update",
          taskId,
          contextId,
          status: { state: "failed", timestamp: new Date().toISOString() },
          final: true,
        });
        eventBus.finished();
        resolve();
      });
    });
  }

  async cancelTask(): Promise<void> {}
}

// ─── Server factory ───────────────────────────────────────────────────────────

/**
 * Create and start an A2A Express server on the given dynamic port.
 * The agentCard.url is updated to reflect the actual port.
 */
export function createAgentServer(
  agentCard: AgentCard,
  executor: AgentExecutor,
  port: number,
): void {
  // Update the card URL to use the actual (dynamic) port
  const card: AgentCard = {
    ...agentCard,
    url: `http://localhost:${port}/a2a/jsonrpc`,
    additionalInterfaces: [
      { url: `http://localhost:${port}/a2a/jsonrpc`, transport: "JSONRPC" },
      { url: `http://localhost:${port}/a2a/rest`, transport: "HTTP+JSON" },
    ],
  };

  const handler = new DefaultRequestHandler(card, new InMemoryTaskStore(), executor);
  const app = express();

  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: handler }));
  app.use(
    "/a2a/jsonrpc",
    jsonRpcHandler({ requestHandler: handler, userBuilder: UserBuilder.noAuthentication }),
  );
  app.use(
    "/a2a/rest",
    restHandler({ requestHandler: handler, userBuilder: UserBuilder.noAuthentication }),
  );

  app.listen(port, "127.0.0.1", () => {
    consola.success(`${card.name}  →  http://localhost:${port}`);
  });
}

/**
 * Build and start an A2A server directly from a shared AgentDef.
 * Derives the agent card and script path from the definition — no per-agent file needed.
 */
export function createServerFromDef(def: AgentDef, port: number): void {
  const agentCard: AgentCard = {
    name: def.displayName,
    description: def.description,
    url: "",
    protocolVersion: "0.3.0",
    version: "1.0.0",
    skills: [],
    capabilities: { streaming: true, pushNotifications: false },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
  };

  const executor = new ScriptAgentExecutor({
    scriptPath: join(AGENTS_ROOT, "src", `${def.name}.ts`),
    agentName: def.displayName,
    requiredEnvVars: def.requiredEnvVars,
    whatItDoes: def.description,
  });

  createAgentServer(agentCard, executor, port);
}
