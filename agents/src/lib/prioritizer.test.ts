import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePrioritizerOutput,
  fallbackResult,
  classifyTickets,
  filterGroup,
} from "./prioritizer.js";

describe("parsePrioritizerOutput", () => {
  it("parses grouped format with all fields", () => {
    const input = JSON.stringify({
      layers: [
        { group: ["EC-100", "EC-104"], relation: "same-epic", hasFrontend: true },
        { group: ["EC-101"], relation: null, hasFrontend: false },
      ],
      skipped: [{ key: "EC-102", reason: "depends on EC-100 (status: In Progress)" }],
      excluded: [{ key: "EC-99", reason: "Done" }],
    });

    const result = parsePrioritizerOutput(input)!;
    assert.equal(result.layers.length, 2);
    assert.deepEqual(result.layers[0].group, ["EC-100", "EC-104"]);
    assert.equal(result.layers[0].relation, "same-epic");
    assert.equal(result.layers[0].hasFrontend, true);
    assert.equal(result.layers[1].hasFrontend, false);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].key, "EC-102");
    assert.equal(result.excluded.length, 1);
    assert.equal(result.excluded[0].key, "EC-99");
  });

  it("parses legacy array-of-arrays format", () => {
    const input = JSON.stringify({
      layers: [["EC-100", "EC-101"], ["EC-102"]],
      skipped: [],
      excluded: [],
    });

    const result = parsePrioritizerOutput(input)!;
    assert.equal(result.layers.length, 2);
    assert.deepEqual(result.layers[0].group, ["EC-100", "EC-101"]);
    assert.equal(result.layers[0].relation, null);
    assert.equal(result.layers[0].hasFrontend, true);
    assert.deepEqual(result.layers[1].group, ["EC-102"]);
  });

  it("strips code fences before parsing", () => {
    const json = JSON.stringify({
      layers: [{ group: ["EC-1"], relation: null, hasFrontend: false }],
      skipped: [],
      excluded: [],
    });
    const input = "```json\n" + json + "\n```";

    const result = parsePrioritizerOutput(input)!;
    assert.equal(result.layers.length, 1);
    assert.deepEqual(result.layers[0].group, ["EC-1"]);
  });

  it("returns null for empty layers", () => {
    const input = JSON.stringify({ layers: [], skipped: [], excluded: [] });
    assert.equal(parsePrioritizerOutput(input), null);
  });

  it("returns null for missing layers", () => {
    const input = JSON.stringify({ skipped: [] });
    assert.equal(parsePrioritizerOutput(input), null);
  });

  it("throws on invalid JSON", () => {
    assert.throws(() => parsePrioritizerOutput("not json"));
  });

  it("defaults missing optional fields", () => {
    const input = JSON.stringify({
      layers: [{ group: ["EC-1"] }],
    });

    const result = parsePrioritizerOutput(input)!;
    assert.equal(result.layers[0].relation, null);
    assert.equal(result.layers[0].hasFrontend, true);
    assert.deepEqual(result.skipped, []);
    assert.deepEqual(result.excluded, []);
  });

  it("parses many sequential single-ticket layers", () => {
    const input = JSON.stringify({
      layers: [
        { group: ["EC-10819"], relation: null, hasFrontend: true },
        { group: ["EC-10820"], relation: null, hasFrontend: true },
        { group: ["EC-10821"], relation: null, hasFrontend: true },
        { group: ["EC-10822"], relation: null, hasFrontend: true },
        { group: ["EC-10823"], relation: null, hasFrontend: true },
        { group: ["EC-10824"], relation: null, hasFrontend: true },
      ],
      skipped: [],
      excluded: [
        { key: "EC-10798", reason: "Pure container story" },
        { key: "EC-10810", reason: "Done" },
      ],
    });

    const result = parsePrioritizerOutput(input)!;
    assert.equal(result.layers.length, 6);
    assert.deepEqual(result.layers[0].group, ["EC-10819"]);
    assert.deepEqual(result.layers[5].group, ["EC-10824"]);
    assert.equal(result.excluded.length, 2);
  });

  it("strips code fences without language tag", () => {
    const json = JSON.stringify({
      layers: [{ group: ["EC-1"], relation: null, hasFrontend: true }],
    });
    const input = "```\n" + json + "\n```";

    const result = parsePrioritizerOutput(input)!;
    assert.deepEqual(result.layers[0].group, ["EC-1"]);
  });

  it("handles leading/trailing whitespace from stdout", () => {
    const json = JSON.stringify({
      layers: [{ group: ["EC-1"], relation: null, hasFrontend: true }],
    });
    const input = "\n\n  " + json + "  \n\n";

    const result = parsePrioritizerOutput(input)!;
    assert.deepEqual(result.layers[0].group, ["EC-1"]);
  });

  it("treats omitted relation as null", () => {
    const input = JSON.stringify({
      layers: [{ group: ["EC-1", "EC-2"], hasFrontend: true }],
    });

    const result = parsePrioritizerOutput(input)!;
    assert.equal(result.layers[0].relation, null);
  });
});

describe("fallbackResult", () => {
  it("wraps single ticket in one layer", () => {
    const result = fallbackResult(["EC-1"]);
    assert.equal(result.layers.length, 1);
    assert.deepEqual(result.layers[0].group, ["EC-1"]);
    assert.equal(result.layers[0].hasFrontend, true);
    assert.deepEqual(result.skipped, []);
    assert.deepEqual(result.excluded, []);
  });

  it("wraps multiple tickets in one layer", () => {
    const result = fallbackResult(["EC-1", "EC-2", "EC-3"]);
    assert.deepEqual(result.layers[0].group, ["EC-1", "EC-2", "EC-3"]);
    assert.equal(result.layers[0].relation, null);
  });

  it("handles empty array", () => {
    const result = fallbackResult([]);
    assert.deepEqual(result.layers[0].group, []);
  });
});

describe("classifyTickets", () => {
  it("separates pending and context tickets", () => {
    const tickets = [
      { key: "EC-1", status: "To Do" },
      { key: "EC-2", status: "In Progress" },
      { key: "EC-3", status: "Backlog" },
      { key: "EC-4", status: "Done" },
    ];

    const { pending, context } = classifyTickets(tickets);
    assert.deepEqual(pending.map((t) => t.key), ["EC-1", "EC-3"]);
    assert.deepEqual(context.map((t) => t.key), ["EC-2", "EC-4"]);
  });

  it("is case-insensitive for status matching", () => {
    const tickets = [
      { key: "EC-1", status: "TO DO" },
      { key: "EC-2", status: "backlog" },
    ];

    const { pending } = classifyTickets(tickets);
    assert.equal(pending.length, 2);
  });

  it("returns all as context when no pending", () => {
    const tickets = [
      { key: "EC-1", status: "In Progress" },
      { key: "EC-2", status: "Done" },
    ];

    const { pending, context } = classifyTickets(tickets);
    assert.equal(pending.length, 0);
    assert.equal(context.length, 2);
  });

  it("returns all as pending when all To Do/Backlog", () => {
    const tickets = [
      { key: "EC-1", status: "To Do" },
      { key: "EC-2", status: "Backlog" },
    ];

    const { pending, context } = classifyTickets(tickets);
    assert.equal(pending.length, 2);
    assert.equal(context.length, 0);
  });

  it("handles empty input", () => {
    const { pending, context } = classifyTickets([]);
    assert.equal(pending.length, 0);
    assert.equal(context.length, 0);
  });

  it("treats In Review, Closed, Resolved as context", () => {
    const tickets = [
      { key: "EC-1", status: "In Review" },
      { key: "EC-2", status: "Closed" },
      { key: "EC-3", status: "Resolved" },
      { key: "EC-4", status: "In Progress" },
    ];

    const { pending, context } = classifyTickets(tickets);
    assert.equal(pending.length, 0);
    assert.equal(context.length, 4);
  });
});

describe("filterGroup", () => {
  const unprocessed = new Set(["EC-1", "EC-2", "EC-3", "EC-4"]);

  it("filters to only unprocessed tickets", () => {
    const result = filterGroup(
      ["EC-1", "EC-2", "EC-5"],
      unprocessed,
      new Set(),
      new Set(),
    );
    assert.deepEqual(result, ["EC-1", "EC-2"]);
  });

  it("excludes skipped tickets", () => {
    const result = filterGroup(
      ["EC-1", "EC-2", "EC-3"],
      unprocessed,
      new Set(["EC-2"]),
      new Set(),
    );
    assert.deepEqual(result, ["EC-1", "EC-3"]);
  });

  it("excludes excluded tickets", () => {
    const result = filterGroup(
      ["EC-1", "EC-2", "EC-3"],
      unprocessed,
      new Set(),
      new Set(["EC-3"]),
    );
    assert.deepEqual(result, ["EC-1", "EC-2"]);
  });

  it("applies all filters together", () => {
    const result = filterGroup(
      ["EC-1", "EC-2", "EC-3", "EC-4", "EC-5"],
      unprocessed,
      new Set(["EC-2"]),
      new Set(["EC-4"]),
    );
    assert.deepEqual(result, ["EC-1", "EC-3"]);
  });

  it("returns empty when no tickets pass", () => {
    const result = filterGroup(
      ["EC-5", "EC-6"],
      unprocessed,
      new Set(),
      new Set(),
    );
    assert.deepEqual(result, []);
  });

  it("handles empty group input", () => {
    const result = filterGroup([], unprocessed, new Set(), new Set());
    assert.deepEqual(result, []);
  });

  it("passes through when all tickets are valid", () => {
    const result = filterGroup(
      ["EC-1", "EC-2", "EC-3"],
      unprocessed,
      new Set(),
      new Set(),
    );
    assert.deepEqual(result, ["EC-1", "EC-2", "EC-3"]);
  });

  it("handles ticket in both skipped and excluded", () => {
    const result = filterGroup(
      ["EC-1", "EC-2", "EC-3"],
      unprocessed,
      new Set(["EC-2"]),
      new Set(["EC-2"]),
    );
    assert.deepEqual(result, ["EC-1", "EC-3"]);
  });
});
