import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function resolveAgentsRoot(): string {
  try {
    // Native ESM (Node.js / tsx): derive from this file's location
    return join(dirname(fileURLToPath(import.meta.url)), "..");
  } catch {
    // webpack/bundler context: chatbot/ is cwd, agents/ is one level up
    return resolve(process.cwd(), "..");
  }
}

/** agents/ — root of the agents monorepo */
export const AGENTS_ROOT = resolveAgentsRoot();
/** agents/dist — compiled agent scripts */
export const AGENTS_DIST = join(AGENTS_ROOT, "dist");
/** agents/settings.json — global settings (watched repositories, etc.) */
export const SETTINGS_FILE = join(AGENTS_ROOT, "settings.json");
/** ~/.claude/scheduler — launchd agent scripts, logs, and state */
export const SCHEDULER_ROOT = join(process.env.HOME!, ".claude/scheduler");
/** ~/.claude/scheduler/logs */
export const SCHEDULER_LOGS = join(SCHEDULER_ROOT, "logs");
/** ~/.claude/scheduler/state */
export const SCHEDULER_STATE = join(SCHEDULER_ROOT, "state");
/** ~/Library/LaunchAgents — macOS launchd user agents directory */
export const LAUNCH_AGENTS_DIR = join(process.env.HOME!, "Library/LaunchAgents");
/** Resolve an agent's entry point to an absolute path under agents/ root */
export const agentEntryPath = (entryPath: string) => join(AGENTS_ROOT, entryPath);
/** agents/node_modules/<pkg> */
export const agentNodeModule = (pkg: string) => join(AGENTS_ROOT, "node_modules", pkg);
/** agents/dist/<agentName>.mjs — compiled agent script */
export const agentDistScript = (agentName: string) => join(AGENTS_DIST, `${agentName}.mjs`);
/** ~/.claude/scheduler/<agentName>.mjs — deployed agent script */
export const schedulerScript = (agentName: string) => join(SCHEDULER_ROOT, `${agentName}.mjs`);
/** ~/.claude/scheduler/node_modules/<pkg> */
export const schedulerNodeModule = (pkg: string) => join(SCHEDULER_ROOT, "node_modules", pkg);
/** ~/.claude/scheduler/logs/.<agentName> — agent log directory */
export const agentLogDir = (agentName: string) => join(SCHEDULER_LOGS, `.${agentName}`);
/** ~/Library/LaunchAgents/<label>.plist */
export const plistFilePath = (label: string) => join(LAUNCH_AGENTS_DIR, `${label}.plist`);
