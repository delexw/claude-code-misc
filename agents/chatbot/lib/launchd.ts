/**
 * Shared helpers for managing launchd agents via launchctl.
 * Used by the heartbeat server and the /api/settings/launchd route.
 */

import { execSync, exec } from "node:child_process";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { join } from "node:path";
import { AGENTS } from "@@/lib/agents";
import type { AgentDef } from "@@/lib/agents";
import {
  AGENTS_ROOT,
  SCHEDULER_ROOT,
  LAUNCH_AGENTS_DIR,
  agentNodeModule,
  agentDistScript,
  schedulerScript,
  schedulerNodeModule,
  agentLogDir,
  plistFilePath,
} from "@@/lib/paths";
import { generatePlist, plistLabel } from "@/lib/plist-generate";
import { externalPackagesInBundle } from "@/lib/bundle-utils";
import type { LaunchdStatus } from "@/a2a/heartbeat-types";

const execAsync = promisify(exec);

/** Returns the current user's numeric UID. */
export function uid(): string {
  return execSync("id -u", { stdio: "pipe" }).toString().trim();
}

/** Resolves the ~/Library/LaunchAgents plist path for a given agent name. */
export function agentPlistPath(agentName: string): string {
  const agent = AGENTS.find((a) => a.name === agentName);
  if (!agent) throw new Error(`Unknown agent: ${agentName}`);
  return plistFilePath(plistLabel(agent));
}

/** Runs a shell command, silently ignoring errors. */
export async function tryRun(cmd: string): Promise<void> {
  try {
    await execAsync(cmd);
  } catch {
    // ignore
  }
}

/** Returns true if the given launchd label is currently loaded. */
export async function isLoaded(label: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("launchctl list");
    return stdout.includes(label);
  } catch {
    return false;
  }
}

/** Write this agent's plist to ~/Library/LaunchAgents without loading it. */
export function writePlist(agent: AgentDef): void {
  const HOME = process.env.HOME!;
  const plistPath = plistFilePath(plistLabel(agent));
  mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
  writeFileSync(plistPath, generatePlist(agent, HOME));
}

/** Bootstrap (load) this agent's plist into launchd. */
export async function loadAgent(agent: AgentDef): Promise<void> {
  const plistPath = plistFilePath(plistLabel(agent));
  await tryRun(`launchctl bootstrap gui/${uid()} ${plistPath}`);
}

/** Bootout (unload) this agent from launchd. */
export async function unloadAgent(agent: AgentDef): Promise<void> {
  const plistPath = plistFilePath(plistLabel(agent));
  const u = uid();
  await tryRun(`launchctl bootout gui/${u} ${plistPath}`);
  await tryRun(`launchctl bootout gui/${u}/${agent.label}`);
}

/**
 * Build and install only this agent (scoped tsup build → deploy script → copy native deps → write plist → bootstrap).
 * Returns whether the agent is loaded after installation.
 */
export async function installAgent(agent: AgentDef): Promise<{ loaded: boolean }> {
  const HOME = process.env.HOME!;
  const plistPath = plistFilePath(plistLabel(agent));
  const u = uid();

  // Step 1: Build only this agent's entry
  await execAsync(`npx tsup --entry.${agent.name}=${agent.entryPath} --metafile`, { cwd: AGENTS_ROOT });

  // Step 2: Deploy this agent's compiled script
  mkdirSync(SCHEDULER_ROOT, { recursive: true });
  copyFileSync(agentDistScript(agent.name), schedulerScript(agent.name));
  chmodSync(schedulerScript(agent.name), 0o755);

  // Step 3: Copy only native packages this agent's bundle imports
  for (const pkg of externalPackagesInBundle(agent.name)) {
    if (existsSync(agentNodeModule(pkg))) {
      mkdirSync(schedulerNodeModule(""), { recursive: true });
      cpSync(agentNodeModule(pkg), schedulerNodeModule(pkg), { recursive: true });
    }
  }

  // Step 4: Write plist and bootstrap
  await tryRun(`launchctl bootout gui/${u} ${plistPath}`);
  await tryRun(`launchctl bootout gui/${u}/${agent.label}`);
  mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
  writeFileSync(plistPath, generatePlist(agent, HOME));
  mkdirSync(agentLogDir(agent.name), { recursive: true });
  await tryRun(`launchctl bootstrap gui/${u} ${plistPath}`);

  return { loaded: await isLoaded(agent.label) };
}

/** Unload and delete only this agent's plist. */
export async function uninstallAgent(agent: AgentDef): Promise<void> {
  const plistPath = plistFilePath(plistLabel(agent));
  const u = uid();

  await tryRun(`launchctl bootout gui/${u} ${plistPath}`);
  await tryRun(`launchctl bootout gui/${u}/${agent.label}`);
  if (existsSync(plistPath)) unlinkSync(plistPath);
}

export interface AgentStatusDetail {
  state: string | null;
  pid: string | null;
  lastExitCode: string | null;
  raw: string;
}

/** Return parsed state/pid/last-exit for a single agent via `launchctl print`. */
export async function getAgentStatus(agent: AgentDef): Promise<AgentStatusDetail> {
  try {
    const { stdout } = await execAsync(`launchctl print gui/${uid()}/${agent.label}`);
    return {
      state: stdout.match(/state\s*=\s*(\S+)/)?.[1] ?? null,
      pid: stdout.match(/\bpid\s*=\s*(\d+)/)?.[1] ?? null,
      lastExitCode: stdout.match(/last exit code\s*=\s*(\S+)/)?.[1] ?? null,
      raw: stdout,
    };
  } catch {
    return { state: null, pid: null, lastExitCode: null, raw: "Agent not loaded or label not found." };
  }
}

/** Return the last N lines from the most recent log file for an agent. */
export function getAgentLogs(agent: AgentDef, lines = 100): string {
  const logDir = agentLogDir(agent.name);
  if (!existsSync(logDir)) return `No log directory found at ${logDir}`;

  const logFiles = readdirSync(logDir)
    .filter((f) => f.endsWith(".log"))
    .map((f) => ({ name: f, mtime: statSync(join(logDir, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (logFiles.length === 0) return "No log files found.";

  const content = readFileSync(join(logDir, logFiles[0].name), "utf-8");
  const all = content.split("\n");
  return `${logFiles[0].name} (last ${lines} lines):\n\n${all.slice(-lines).join("\n")}`;
}

/**
 * Returns launchd load+running status for all agents, keyed by manifestKey.
 * Used by the heartbeat server.
 */
export async function getLaunchdStatuses(): Promise<Record<string, LaunchdStatus>> {
  try {
    const { stdout } = await execAsync("launchctl list");
    // Each line: "PID\tStatus\tLabel" (tab-separated); PID is "-" when stopped
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
    return Object.fromEntries(
      AGENTS.map((a) => [a.manifestKey, { loaded: false, running: false }]),
    );
  }
}
