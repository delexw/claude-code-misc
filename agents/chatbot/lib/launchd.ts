/**
 * Shared helpers for managing launchd agents via launchctl.
 * Used by the heartbeat server and the /api/settings/launchd route.
 */

import { execSync, exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { AGENTS } from "@@/lib/agents";
import {
  AGENTS_ROOT,
  AGENTS_DIST,
  SCHEDULER_ROOT,
  SCHEDULER_LOGS,
  LAUNCH_AGENTS_DIR,
} from "@@/lib/paths";
import { plistLabel } from "@/lib/plist-generate";
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
  return join(LAUNCH_AGENTS_DIR, `${plistLabel(agent)}.plist`);
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
