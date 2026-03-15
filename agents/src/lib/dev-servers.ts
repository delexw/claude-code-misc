import { readFileSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { createConnection } from "node:net";
import { spawn, execSync, type ChildProcess } from "node:child_process";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ServiceConfig {
  name: string;
  cwd: string;
  cmd: string;
  port: number;
  url: string;
  branchFixed: boolean;
}

interface BootstrapConfig {
  devUrl: string;
  services: ServiceConfig[];
}

interface RunningServer {
  config: ServiceConfig;
  process: ChildProcess;
}

// ─── DevServerManager ────────────────────────────────────────────────────────

export class DevServerManager {
  private readonly home: string;
  private readonly configPath: string;
  private readonly logDir: string;
  private readonly log: (msg: string) => void;
  private running: RunningServer[] = [];

  constructor(home: string, configPath: string, logDir: string, log: (msg: string) => void) {
    this.home = home;
    this.configPath = configPath;
    this.logDir = logDir;
    this.log = log;
    mkdirSync(logDir, { recursive: true });
  }

  // ─── Config ──────────────────────────────────────────────────────────────

  loadConfig(): BootstrapConfig {
    const raw: BootstrapConfig = JSON.parse(readFileSync(this.configPath, "utf-8"));
    return {
      devUrl: raw.devUrl,
      services: raw.services.map((s) => ({
        ...s,
        cwd: s.cwd.replace("~", this.home),
      })),
    };
  }

  get devUrl(): string {
    return this.loadConfig().devUrl;
  }

  get services(): ServiceConfig[] {
    return this.loadConfig().services;
  }

  // ─── Start ───────────────────────────────────────────────────────────────

  async startAll(): Promise<void> {
    this.log("STARTING dev servers (detached processes)...");
    for (const svc of this.services) {
      this.spawnService(svc);
    }
    await this.waitForReady();
  }

  // ─── Readiness ─────────────────────────────────────────────────────────

  async waitForReady(timeoutMs = 120_000, pollMs = 2_000): Promise<void> {
    const toCheck = this.running.filter((s) => s.config.port > 0);
    if (toCheck.length === 0) return;

    this.log(`Waiting for ${toCheck.length} server(s) to be ready (timeout: ${timeoutMs / 1000}s)...`);
    const deadline = Date.now() + timeoutMs;
    const pending = new Set(toCheck.map((s) => s.config.name));

    while (pending.size > 0 && Date.now() < deadline) {
      const checks = toCheck
        .filter((s) => pending.has(s.config.name))
        .map(async (s) => {
          const up = await this.isPortOpen(s.config.port);
          if (up) {
            this.log(`  READY: ${s.config.name} (port ${s.config.port})`);
            pending.delete(s.config.name);
          }
        });
      await Promise.all(checks);
      if (pending.size > 0) await this.sleep(pollMs);
    }

    if (pending.size > 0) {
      const names = [...pending].join(", ");
      this.log(`WARN: servers not ready after ${timeoutMs / 1000}s: ${names}`);
    }
  }

  private isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection({ port, host: "127.0.0.1" });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => { socket.destroy(); resolve(false); });
      socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Stop ────────────────────────────────────────────────────────────────

  stopAll(): void {
    this.log("STOPPING dev servers...");
    for (const server of this.running) {
      this.killServer(server);
    }
    this.running = [];
  }

  // ─── Restart non-fixed-branch servers on a merge branch ──────────────────

  async restartOnBranch(mergeBranch: string): Promise<void> {
    const toRestart = this.services.filter((s) => !s.branchFixed);
    if (toRestart.length === 0) return;

    this.log(`RESTARTING ${toRestart.length} server(s) on branch: ${mergeBranch}`);

    // Kill only the non-fixed-branch servers
    for (const server of [...this.running]) {
      if (!server.config.branchFixed) {
        this.killServer(server);
        this.running.splice(this.running.indexOf(server), 1);
      }
    }

    // Checkout merge branch and restart
    for (const svc of toRestart) {
      const name = svc.name;
      try {
        execSync(`git checkout ${mergeBranch}`, { cwd: svc.cwd, stdio: "pipe" });
        this.log(`  Checked out ${mergeBranch} in ${name}`);
      } catch (e: unknown) {
        this.log(`  WARN: git checkout failed for ${name}: ${(e as Error).message}`);
      }
      this.spawnService(svc);
    }

    await this.waitForReady();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private spawnService(svc: ServiceConfig): void {
    const name = svc.name;
    const logPath = join(this.logDir, `${name}.log`);
    const fd = openSync(logPath, "w");
    const useShell = svc.cmd.includes("|");

    const child = spawn(
      useShell ? "/bin/bash" : svc.cmd,
      useShell ? ["-c", svc.cmd] : [],
      {
        cwd: svc.cwd,
        detached: true,
        stdio: ["ignore", fd, fd],
        env: { ...process.env, OBJC_DISABLE_INITIALIZE_FORK_SAFETY: "YES" },
      },
    );
    child.unref();
    this.running.push({ config: svc, process: child });
    this.log(`  Started ${name} (PID: ${child.pid}) -> ${logPath}`);
  }

  private killServer(server: RunningServer): void {
    const name = server.config.name;
    if (server.process.pid) {
      try {
        process.kill(-server.process.pid, "SIGTERM");
        this.log(`  Stopped ${name} (PID: ${server.process.pid})`);
      } catch {
        // already dead
      }
    }
  }

}
