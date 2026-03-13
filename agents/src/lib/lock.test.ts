import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { acquireLock, registerChildPid, unregisterChildPid, _resetForTest } from "./lock.js";

function readLockData(lockFile: string) {
  return JSON.parse(readFileSync(lockFile, "utf-8"));
}

/** Spawn a long-lived child process and return its PID */
function spawnSleeper(): { pid: number; kill: () => void } {
  const child = spawn("sleep", ["300"], { stdio: "ignore" });
  return { pid: child.pid!, kill: () => { try { process.kill(child.pid!, "SIGTERM"); } catch {} } };
}

function waitForDeath(pid: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      try {
        process.kill(pid, 0);
        if (Date.now() < deadline) setTimeout(check, 50);
        else resolve(false); // still alive
      } catch {
        resolve(true); // dead
      }
    };
    check();
  });
}

describe("lock", () => {
  let tmpDir: string;
  let lockFile: string;
  const sleepers: Array<{ kill: () => void }> = [];

  beforeEach(() => {
    _resetForTest();
    tmpDir = mkdtempSync(join(tmpdir(), "lock-test-"));
    lockFile = join(tmpDir, "lock");
  });

  afterEach(() => {
    try { unlinkSync(lockFile); } catch {}
    sleepers.forEach((s) => s.kill());
    sleepers.length = 0;
  });

  it("acquires lock and writes pid to file", () => {
    const result = acquireLock(lockFile);
    assert.equal(result, true);
    assert.equal(existsSync(lockFile), true);

    const data = readLockData(lockFile);
    assert.equal(data.pid, process.pid);
    assert.deepEqual(data.children, []);
  });

  it("rejects second acquire when first is alive", () => {
    acquireLock(lockFile);
    const second = acquireLock(lockFile);
    assert.equal(second, false);
  });

  it("reclaims stale lock from dead process", () => {
    writeFileSync(lockFile, JSON.stringify({ pid: 999999, children: [] }));

    const result = acquireLock(lockFile);
    assert.equal(result, true);

    const data = readLockData(lockFile);
    assert.equal(data.pid, process.pid);
  });

  it("registerChildPid adds child to lock file", () => {
    acquireLock(lockFile);

    const sleeper = spawnSleeper();
    sleepers.push(sleeper);

    registerChildPid(sleeper.pid);

    const data = readLockData(lockFile);
    assert.ok(data.children.includes(sleeper.pid));
  });

  it("unregisterChildPid removes child from lock file", () => {
    acquireLock(lockFile);

    const sleeper = spawnSleeper();
    sleepers.push(sleeper);

    registerChildPid(sleeper.pid);
    unregisterChildPid(sleeper.pid);

    const data = readLockData(lockFile);
    assert.ok(!data.children.includes(sleeper.pid));
  });

  it("tracks multiple children correctly", () => {
    acquireLock(lockFile);

    const s1 = spawnSleeper();
    const s2 = spawnSleeper();
    sleepers.push(s1, s2);

    registerChildPid(s1.pid);
    registerChildPid(s2.pid);

    let data = readLockData(lockFile);
    assert.equal(data.children.length, 2);
    assert.ok(data.children.includes(s1.pid));
    assert.ok(data.children.includes(s2.pid));

    unregisterChildPid(s1.pid);

    data = readLockData(lockFile);
    assert.equal(data.children.length, 1);
    assert.ok(data.children.includes(s2.pid));
  });

  it("kills orphaned children when reclaiming stale lock", async () => {
    const sleeper = spawnSleeper();
    sleepers.push(sleeper);

    // Verify the child is alive
    assert.doesNotThrow(() => process.kill(sleeper.pid, 0));

    // Simulate a stale lock from a dead parent with a live child
    writeFileSync(lockFile, JSON.stringify({ pid: 999999, children: [sleeper.pid] }));

    acquireLock(lockFile);

    const died = await waitForDeath(sleeper.pid);
    assert.equal(died, true, "orphaned child should have been killed");
  });
});
