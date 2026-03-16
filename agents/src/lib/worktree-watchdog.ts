import { existsSync } from "node:fs";

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;
const DEFAULT_POLL_MS = 5_000;

interface WatchdogOpts {
  timeoutMs?: number;
  pollMs?: number;
}

/**
 * Watches for a worktree directory to appear on disk.
 * If it doesn't appear within the timeout, resolves as "hung".
 * Once the directory appears, the watchdog stands down (never resolves).
 */
export class WorktreeWatchdog {
  private readonly timeoutMs: number;
  private readonly pollMs: number;

  constructor(opts?: WatchdogOpts) {
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.pollMs = opts?.pollMs ?? DEFAULT_POLL_MS;
  }

  /**
   * Returns a promise that resolves to "hung" if the path never appears
   * within the timeout. If the path does appear, the promise never resolves
   * (allowing Promise.race callers to proceed with the real work).
   */
  watch(path: string): Promise<"hung"> {
    return new Promise((resolve) => {
      const deadline = Date.now() + this.timeoutMs;
      const interval = setInterval(() => {
        if (existsSync(path)) {
          clearInterval(interval);
          return;
        }
        if (Date.now() >= deadline) {
          clearInterval(interval);
          resolve("hung");
        }
      }, this.pollMs);
      if (typeof interval === "object" && "unref" in interval) interval.unref();
    });
  }

  get timeoutSec(): number {
    return this.timeoutMs / 1000;
  }
}
