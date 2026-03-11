import { mkdirSync, appendFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export function makeTimestamp(): string {
  return new Date().toLocaleString("sv-SE").replace(/[ :]/g, "_");
}

export function createLogger(logDir: string, logFile: string) {
  mkdirSync(logDir, { recursive: true });

  function log(msg: string): void {
    const line = `[${new Date().toLocaleString("sv-SE")}] ${msg}`;
    console.log(line);
    appendFileSync(logFile, line + "\n");
  }

  return { log, logFile };
}

export function cleanupOldLogs(
  logDir: string,
  prefixes: string[],
  retentionDays: number,
): void {
  const cutoff = Date.now() - retentionDays * 86_400_000;
  for (const prefix of prefixes) {
    try {
      for (const file of readdirSync(logDir)) {
        if (!file.startsWith(prefix)) continue;
        const filepath = join(logDir, file);
        if (statSync(filepath).mtimeMs < cutoff) unlinkSync(filepath);
      }
    } catch {}
  }
}
