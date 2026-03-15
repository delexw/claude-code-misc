import { exec } from "./exec.js";

export class JiraClient {
  constructor(
    private cli: string,
    private server: string,
    private assignee: string,
    private sprintPrefix: string,
  ) {}

  async getActiveSprint(): Promise<string | null> {
    const { ok, stdout } = await exec(this.cli, [
      "sprint",
      "list",
      "--state",
      "active",
      "--plain",
      "--no-headers",
    ]);
    if (!ok) return null;
    const line = stdout.split("\n").find((l) => l.includes(this.sprintPrefix));
    if (!line) return null;
    return line.split("\t")[1]?.trim() || null;
  }

  async fetchSprintTickets(sprint: string): Promise<Array<{ key: string; status: string }>> {
    const jql = `assignee = '${this.assignee}' AND sprint = '${sprint}'`;
    const { ok, stdout } = await exec(this.cli, [
      "issue",
      "list",
      "-q",
      jql,
      "--plain",
      "--no-headers",
      "--columns",
      "KEY,STATUS",
    ]);
    if (!ok || !stdout) return [];
    return stdout
      .split("\n")
      .map((l) => {
        const parts = l.split("\t").map((p) => p.trim());
        return { key: parts[0], status: parts[1] || "" };
      })
      .filter((t) => t.key);
  }

  async moveTicket(ticketKey: string, status: string): Promise<boolean> {
    const { ok } = await exec(this.cli, ["issue", "move", ticketKey, status]);
    return ok;
  }

  ticketUrl(ticketKey: string): string {
    return `${this.server}/browse/${ticketKey}`;
  }
}
