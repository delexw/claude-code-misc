import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";

interface LockData {
  pid: number;
  children: number[];
}

function readLock(lockFile: string): LockData | null {
  try {
    return JSON.parse(readFileSync(lockFile, "utf-8"));
  } catch {
    return null;
  }
}

function writeLock(lockFile: string, data: LockData): void {
  writeFileSync(lockFile, JSON.stringify(data));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

let currentLockFile: string | null = null;
let trackedChildren = new Set<number>();

/** Reset module state — for testing only */
export function _resetForTest(): void {
  currentLockFile = null;
  trackedChildren = new Set();
}

export function registerChildPid(pid: number): void {
  trackedChildren.add(pid);
  if (currentLockFile) {
    const data = readLock(currentLockFile);
    if (data) {
      data.children = [...trackedChildren];
      writeLock(currentLockFile, data);
    }
  }
}

export function unregisterChildPid(pid: number): void {
  trackedChildren.delete(pid);
  if (currentLockFile) {
    const data = readLock(currentLockFile);
    if (data) {
      data.children = [...trackedChildren];
      writeLock(currentLockFile, data);
    }
  }
}

export function acquireLock(lockFile: string): boolean {
  if (existsSync(lockFile)) {
    const existing = readLock(lockFile);
    if (existing) {
      if (isAlive(existing.pid)) {
        return false; // another instance running
      }
      // Parent is dead — kill any orphaned children
      for (const childPid of existing.children ?? []) {
        try {
          process.kill(childPid, "SIGTERM");
        } catch {}
      }
      unlinkSync(lockFile); // stale lock
    }
  }

  currentLockFile = lockFile;
  writeLock(lockFile, { pid: process.pid, children: [] });

  const cleanup = () => {
    try {
      unlinkSync(lockFile);
    } catch {}
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => process.exit(1));
  process.on("SIGTERM", () => process.exit(1));
  return true;
}
