import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

/**
 * Tracks which ticket keys have been processed today.
 * Automatically resets when the date changes.
 */
export class ProcessedTracker {
  constructor(private filePath: string) {}

  load(): Set<string> {
    const today = new Date().toLocaleString("sv-SE").slice(0, 10);
    const content = this.readSafe();
    const lines = content.split("\n").filter(Boolean);
    if (lines[0] !== today) {
      writeFileSync(this.filePath, today + "\n");
      return new Set();
    }
    return new Set(lines.slice(1));
  }

  mark(ticketKey: string): void {
    appendFileSync(this.filePath, ticketKey + "\n");
  }

  private readSafe(): string {
    try {
      return readFileSync(this.filePath, "utf-8");
    } catch {
      return "";
    }
  }
}
