/**
 * WebSocket heartbeat server — pings each agent's A2A agent-card endpoint
 * every INTERVAL_MS and broadcasts live status to all connected clients.
 *
 * Port: WS_PORT (Next.js runs on 7473)
 *
 * Message shape (server → client):
 *   { type: "status", agents: { [manifestKey]: { online: boolean, latency: number | null } } }
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { WebSocketServer, WebSocket } from "ws";
import { consola } from "consola";
import { AGENTS } from "@@/lib/agents";
import type { PortsManifest } from "./lib/base-server.js";
import { WS_PORT } from "./heartbeat-types.js";
import type { AgentStatus, LaunchdStatus, StatusMessage } from "./heartbeat-types.js";

const execAsync = promisify(exec);
const INTERVAL_MS = 10_000;
const PING_TIMEOUT_MS = 5_000;

async function pingAgent(port: number): Promise<Pick<AgentStatus, "online" | "latency">> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(`http://localhost:${port}/.well-known/agent-card.json`, {
      signal: controller.signal,
    });
    const latency = Date.now() - t0;
    return { online: res.ok, latency };
  } catch {
    return { online: false, latency: null };
  } finally {
    clearTimeout(timer);
  }
}

async function checkLaunchd(): Promise<Record<string, LaunchdStatus>> {
  try {
    const { stdout } = await execAsync("launchctl list");
    // Each line: "PID\tStatus\tLabel" (tab-separated)
    const loaded = new Map<string, boolean>(); // label → running
    for (const line of stdout.split("\n")) {
      const [pid, , ...labelParts] = line.split("\t");
      const label = labelParts.join("\t").trim();
      if (label) loaded.set(label, pid !== "-");
    }
    return Object.fromEntries(
      AGENTS.map((a) => {
        const running = loaded.get(a.label);
        return [
          a.manifestKey,
          running !== undefined ? { loaded: true, running } : { loaded: false, running: false },
        ];
      }),
    );
  } catch {
    return Object.fromEntries(AGENTS.map((a) => [a.manifestKey, { loaded: false, running: false }]));
  }
}

async function checkAll(manifest: PortsManifest): Promise<Record<string, AgentStatus>> {
  const keys = Object.keys(manifest).filter((k) => k !== "updatedAt") as Array<
    keyof Omit<PortsManifest, "updatedAt">
  >;
  const [pingResults, launchdMap] = await Promise.all([
    Promise.all(keys.map((k) => pingAgent(manifest[k] as number))),
    checkLaunchd(),
  ]);
  return Object.fromEntries(
    keys.map((k, i) => [k, { ...pingResults[i], launchd: launchdMap[k] ?? null }]),
  );
}

export function startHeartbeatServer(manifest: PortsManifest): void {
  const wss = new WebSocketServer({ port: WS_PORT, host: "127.0.0.1" });

  let current: Record<string, AgentStatus> = {};

  function broadcast(msg: StatusMessage) {
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  async function heartbeat() {
    current = await checkAll(manifest);
    broadcast({ type: "status", agents: current });
  }

  wss.on("connection", (ws) => {
    // Send current status immediately so the client doesn't wait for the next interval
    if (Object.keys(current).length > 0) {
      ws.send(JSON.stringify({ type: "status", agents: current }));
    }
  });

  wss.on("listening", () => {
    consola.success(`Heartbeat WS  →  ws://127.0.0.1:${WS_PORT}`);
  });

  // Run first check immediately, then on interval
  void heartbeat();
  setInterval(() => void heartbeat(), INTERVAL_MS);
}
