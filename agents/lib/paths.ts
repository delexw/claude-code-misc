import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** agents/ — root of the agents monorepo */
export const AGENTS_ROOT = join(__dirname, "..");
/** agents/settings.json — global settings (watched repositories, etc.) */
export const SETTINGS_FILE = join(AGENTS_ROOT, "settings.json");
/** ~/.claude/scheduler — launchd agent scripts, logs, and state */
export const SCHEDULER_ROOT = join(process.env.HOME!, ".claude/scheduler");
/** ~/.claude/scheduler/logs */
export const SCHEDULER_LOGS = join(SCHEDULER_ROOT, "logs");
/** ~/.claude/scheduler/state */
export const SCHEDULER_STATE = join(SCHEDULER_ROOT, "state");
