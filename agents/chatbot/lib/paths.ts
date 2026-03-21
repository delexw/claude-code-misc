import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** agents/chatbot/ */
export const CHATBOT_ROOT = join(__dirname, "..");
/** agents/ */
export const AGENTS_ROOT = join(CHATBOT_ROOT, "..");
/** tsx binary in chatbot's node_modules */
export const TSX_BIN = join(CHATBOT_ROOT, "node_modules/.bin/tsx");
/** Runtime port manifest written by a2a/start-all.ts */
export const PORTS_FILE = join(CHATBOT_ROOT, "a2a/.ports.json");
