import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

const HOME = process.env.HOME!;
const CLAUDE_CLI = join(HOME, ".local/bin/claude");

// Unset nested session guard so Claude CLI can launch
delete (process.env as Record<string, unknown>).CLAUDECODE;

interface SpawnClaudeOptions {
  cwd?: string;
  taskName: string;
  timeoutMs?: number;
  stderrToLog?: string; // log file path to write stderr to
}

interface SpawnClaudeResult {
  code: number;
  stdout: string;
}

export function spawnClaude(
  args: string[],
  opts: SpawnClaudeOptions,
): Promise<SpawnClaudeResult> {
  const { cwd, taskName, timeoutMs = 30 * 60 * 1000, stderrToLog } = opts;

  return new Promise((resolve) => {
    const child = spawn(CLAUDE_CLI, args, {
      cwd,
      env: {
        ...process.env,
        CLAUDECODE: undefined,
        CLAUDE_SCHEDULER_TASK: taskName,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (data: Buffer) => chunks.push(data));
    child.stderr.on("data", (data: Buffer) => {
      if (stderrToLog) appendFileSync(stderrToLog, data);
      else stderrChunks.push(data);
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(chunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();
      resolve({
        code: code ?? 1,
        stdout: stderrToLog ? stdout : stdout + stderr,
      });
    });
  });
}

