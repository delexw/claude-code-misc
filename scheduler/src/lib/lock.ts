import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";

export function acquireLock(lockFile: string): boolean {
  if (existsSync(lockFile)) {
    const existingPid = readFileSync(lockFile, "utf-8").trim();
    if (existingPid) {
      try {
        process.kill(Number(existingPid), 0);
        return false; // another instance running
      } catch {
        unlinkSync(lockFile); // stale lock
      }
    }
  }
  writeFileSync(lockFile, String(process.pid));
  process.on("exit", () => {
    try {
      unlinkSync(lockFile);
    } catch {}
  });
  process.on("SIGINT", () => process.exit(1));
  process.on("SIGTERM", () => process.exit(1));
  return true;
}
