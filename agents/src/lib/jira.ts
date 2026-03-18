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

  /** Get the parent ticket key for a sub-task, or null if none. */
  async getParentKey(ticketKey: string): Promise<string | null> {
    const { ok, stdout } = await exec(this.cli, ["issue", "view", ticketKey, "--raw"]);
    if (!ok || !stdout) return null;
    try {
      const data = JSON.parse(stdout) as { fields?: { parent?: { key?: string } } };
      return data.fields?.parent?.key ?? null;
    } catch {
      return null;
    }
  }

  /** Check if a parent ticket has any sub-tasks assigned to this user still in To Do or Backlog. */
  async hasUnfinishedSubtasks(parentKey: string): Promise<boolean> {
    const jql = `parent = '${parentKey}' AND assignee = '${this.assignee}' AND status IN ('To Do', 'Backlog', 'In Progress')`;
    const { ok, stdout } = await exec(this.cli, [
      "issue",
      "list",
      "-q",
      jql,
      "--plain",
      "--no-headers",
      "--columns",
      "KEY",
    ]);
    if (!ok) return true; // assume unfinished on error
    return stdout.trim().length > 0;
  }

  /**
   * Move a ticket to In Review and promote its parent if all sub-tasks are done.
   * Returns the set of parent keys that were promoted (for dedup across calls).
   */
  async promoteToReview(
    ticketKey: string,
    log: (msg: string) => void,
    promotedParents?: Set<string>,
  ): Promise<void> {
    const moved = await this.moveTicket(ticketKey, "In Review");
    if (!moved) log(`WARN: Could not move ${ticketKey} to In Review`);

    const parentKey = await this.getParentKey(ticketKey);
    if (parentKey && !promotedParents?.has(parentKey)) {
      const hasUnfinished = await this.hasUnfinishedSubtasks(parentKey);
      if (!hasUnfinished) {
        promotedParents?.add(parentKey);
        const parentMoved = await this.moveTicket(parentKey, "In Review");
        if (parentMoved) log(`PARENT: moved ${parentKey} to In Review (all sub-tasks complete)`);
        else log(`WARN: Could not move parent ${parentKey} to In Review`);
      }
    }
  }

  async addComment(ticketKey: string, body: string): Promise<boolean> {
    const { ok } = await exec(this.cli, ["issue", "comment", "add", ticketKey, "--body", body]);
    return ok;
  }

  ticketUrl(ticketKey: string): string {
    return `${this.server}/browse/${ticketKey}`;
  }
}
