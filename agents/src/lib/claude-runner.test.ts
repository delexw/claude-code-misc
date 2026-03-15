import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ClaudeRunner } from "./claude-runner.js";

const TMP_DIR = join(import.meta.dirname, ".test-tmp-claude-runner");

void describe("ClaudeRunner", () => {
  void describe("writeLog", () => {
    const runner = new ClaudeRunner("/cwd", TMP_DIR, "/dev/null", "2026-03-15_10_00_00");

    void it("writes content to log file with correct name", () => {
      mkdirSync(TMP_DIR, { recursive: true });
      try {
        const path = runner.writeLog("task", "EC-123", "forge output here");
        assert.equal(path, join(TMP_DIR, "task-EC-123-2026-03-15_10_00_00.log"));
        assert.equal(readFileSync(path, "utf-8"), "forge output here");
      } finally {
        rmSync(TMP_DIR, { recursive: true, force: true });
      }
    });

    void it("returns the full path to the log file", () => {
      mkdirSync(TMP_DIR, { recursive: true });
      try {
        const path = runner.writeLog("merge", "EC-456", "merge output");
        assert.ok(path.endsWith("merge-EC-456-2026-03-15_10_00_00.log"));
      } finally {
        rmSync(TMP_DIR, { recursive: true, force: true });
      }
    });

    void it("uses the timestamp from constructor", () => {
      const runner2 = new ClaudeRunner("/cwd", TMP_DIR, "/dev/null", "custom_ts");
      mkdirSync(TMP_DIR, { recursive: true });
      try {
        const path = runner2.writeLog("verify", "EC-1", "content");
        assert.ok(path.includes("custom_ts"));
      } finally {
        rmSync(TMP_DIR, { recursive: true, force: true });
      }
    });
  });
});
