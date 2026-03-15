import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnClaude } from "./claude.js";

export type LogFn = (msg: string) => void;

interface RunOpts {
  repos?: string[];
  taskName: string;
  timeoutMs?: number;
  cwd?: string;
  model?: string;
  effort?: string;
  worktree?: string;
  continueSession?: boolean;
}

export class ClaudeRunner {
  constructor(
    private readonly cwd: string,
    private readonly logDir: string,
    private readonly logFile: string,
    private readonly timestamp: string,
  ) {}

  async run(prompt: string, opts: RunOpts): Promise<{ code: number; stdout: string }> {
    const args = [
      ...(opts.model ? ["--model", opts.model] : []),
      ...(opts.effort ? ["--effort", opts.effort] : []),
      ...(opts.worktree ? ["-w", opts.worktree] : []),
      ...(opts.continueSession ? ["-c"] : []),
      "--permission-mode",
      "acceptEdits",
    ];
    if (!opts.worktree && opts.repos) args.push("--add-dir", ...opts.repos);
    args.push("-p", prompt);

    return spawnClaude(args, {
      cwd: opts.cwd ?? this.cwd,
      taskName: opts.taskName,
      timeoutMs: opts.timeoutMs ?? 24 * 60 * 60 * 1000,
      stderrToLog: this.logFile,
    });
  }

  writeLog(prefix: string, id: string, content: string): string {
    const path = join(this.logDir, `${prefix}-${id}-${this.timestamp}.log`);
    writeFileSync(path, content);
    return path;
  }
}
