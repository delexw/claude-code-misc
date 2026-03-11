import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface ExecResult {
  ok: boolean;
  stdout: string;
  stderr?: string;
  code?: string | number | null;
}

export async function exec(
  cmd: string,
  args: string[],
  opts: Record<string, unknown> = {},
): Promise<ExecResult> {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      timeout: 30_000,
      ...opts,
    } as Parameters<typeof execFileAsync>[2]);
    return { ok: true, stdout: stdout.trim() };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: string | number | null };
    return {
      ok: false,
      stdout: (e.stdout || "").trim(),
      stderr: (e.stderr || "").trim(),
      code: e.code,
    };
  }
}
