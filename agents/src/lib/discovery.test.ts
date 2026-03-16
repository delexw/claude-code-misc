import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SprintDiscovery } from "./discovery.js";
import type { JiraClient } from "./jira.js";
import type { ProcessedTracker } from "./processed-tracker.js";

function makeJira(
  sprint: string | null = "Sprint 1",
  tickets: Array<{ key: string; status: string }> = [],
): JiraClient {
  return {
    getActiveSprint: async () => sprint,
    fetchSprintTickets: async () => tickets,
  } as unknown as JiraClient;
}

function makeTracker(processed: string[] = []): ProcessedTracker {
  return { load: () => new Set(processed) } as unknown as ProcessedTracker;
}

void describe("SprintDiscovery", () => {
  void it("returns null when no active sprint", async () => {
    const d = new SprintDiscovery(makeJira(null), makeTracker(), []);
    assert.equal(await d.discover(), null);
  });

  void it("returns null when sprint has no tickets", async () => {
    const d = new SprintDiscovery(makeJira("Sprint 1", []), makeTracker(), []);
    assert.equal(await d.discover(), null);
  });

  void it("returns null when all pending tickets are already processed", async () => {
    const d = new SprintDiscovery(
      makeJira("Sprint 1", [
        { key: "EC-1", status: "To Do" },
        { key: "EC-2", status: "In Progress" },
      ]),
      makeTracker(["EC-1"]),
      [],
    );
    assert.equal(await d.discover(), null);
  });

  void it("returns null when all tickets are context (no pending)", async () => {
    const d = new SprintDiscovery(
      makeJira("Sprint 1", [
        { key: "EC-1", status: "In Progress" },
        { key: "EC-2", status: "Done" },
      ]),
      makeTracker(),
      [],
    );
    assert.equal(await d.discover(), null);
  });

  void it("returns discovery result with unprocessed tickets", async () => {
    const d = new SprintDiscovery(
      makeJira("Sprint 1", [
        { key: "EC-1", status: "To Do" },
        { key: "EC-2", status: "Backlog" },
        { key: "EC-3", status: "In Progress" },
      ]),
      makeTracker(),
      [],
    );

    const result = await d.discover();
    assert.ok(result);
    assert.deepEqual(result.allKeys, ["EC-1", "EC-2", "EC-3"]);
    assert.deepEqual(result.unprocessed, ["EC-1", "EC-2"]);
    assert.equal(result.skippedCount, 0);
  });

  void it("separates processed from unprocessed and counts skips", async () => {
    const d = new SprintDiscovery(
      makeJira("Sprint 1", [
        { key: "EC-1", status: "To Do" },
        { key: "EC-2", status: "To Do" },
        { key: "EC-3", status: "Backlog" },
      ]),
      makeTracker(["EC-1"]),
      [],
    );

    const result = await d.discover();
    assert.ok(result);
    assert.deepEqual(result.unprocessed, ["EC-2", "EC-3"]);
    assert.equal(result.skippedCount, 1);
  });

  void it("logs when logger provided, silent when not", async () => {
    const d = new SprintDiscovery(
      makeJira("Sprint 1", [{ key: "EC-1", status: "To Do" }]),
      makeTracker(),
      [],
    );

    // Silent — no log
    const result1 = await d.discover();
    assert.ok(result1);

    // With log
    const logs: string[] = [];
    const result2 = await d.discover((msg) => logs.push(msg));
    assert.ok(result2);
    assert.ok(logs.some((l) => l.includes("Found 1 ticket")));
  });
});
