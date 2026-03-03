#!/usr/bin/env node

/**
 * Build a dependency graph from parsed JIRA ticket JSON and run topological sort.
 *
 * Usage:
 *   node build-dependency-graph.js < all-tickets.json > graph.json
 *
 * Input:  JSON array of parsed ticket objects (jira-ticket-viewer output schema)
 * Output: JSON with layers, edges, externalDeps, cycles, warnings
 *
 * No external npm dependencies.
 */

const fs = require("fs");

// ---------------------------------------------------------------------------
// Relationship mapping
// ---------------------------------------------------------------------------

const HARD_FORWARD = new Set([
  "blocks",
  "causes",
  "has to be done before",
]);

const HARD_REVERSE = new Set([
  "is blocked by",
  "is caused by",
  "has to be done after",
]);

const SKIP = new Set([
  "duplicates",
  "is duplicated by",
  "clones",
  "is cloned by",
]);

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

function buildGraph(tickets) {
  const keys = new Set(tickets.map((t) => t.key));
  const edges = [];
  const relatesToPairs = [];
  const externalDeps = [];

  for (const ticket of tickets) {
    const linkedIssues = ticket.linkedIssues || [];

    for (const link of linkedIssues) {
      const rel = (link.relationship || "").toLowerCase();
      const otherKey = link.key;

      if (SKIP.has(rel)) continue;

      if (!keys.has(otherKey)) {
        externalDeps.push({
          key: otherKey,
          relationship: link.relationship,
          status: link.status || null,
          referencedBy: ticket.key,
        });
        continue;
      }

      if (HARD_FORWARD.has(rel)) {
        edges.push({
          from: ticket.key,
          to: otherKey,
          type: "hard",
          relationship: link.relationship,
        });
      } else if (HARD_REVERSE.has(rel)) {
        edges.push({
          from: otherKey,
          to: ticket.key,
          type: "hard",
          relationship: link.relationship,
        });
      } else if (rel === "relates to") {
        relatesToPairs.push({ a: ticket.key, b: otherKey });
      }
    }

    // Also check for soft edges from ticket data
    const softEdges = ticket.softEdges || [];
    for (const se of softEdges) {
      if (keys.has(se.from) && keys.has(se.to)) {
        edges.push({
          from: se.from,
          to: se.to,
          type: "soft",
          confidence: se.confidence || "medium",
          evidence: se.evidence || "",
        });
      }
    }
  }

  // Deduplicate edges
  const edgeSet = new Set();
  const uniqueEdges = [];
  for (const edge of edges) {
    const id = `${edge.from}->${edge.to}`;
    if (!edgeSet.has(id)) {
      edgeSet.add(id);
      uniqueEdges.push(edge);
    }
  }

  return { keys, edges: uniqueEdges, relatesToPairs, externalDeps };
}

// ---------------------------------------------------------------------------
// Kahn's topological sort
// ---------------------------------------------------------------------------

function topologicalSort(nodeKeys, edges) {
  const inDegree = {};
  const adjacency = {};

  for (const key of nodeKeys) {
    inDegree[key] = 0;
    adjacency[key] = [];
  }

  for (const edge of edges) {
    if (nodeKeys.has(edge.from) && nodeKeys.has(edge.to)) {
      adjacency[edge.from].push(edge.to);
      inDegree[edge.to]++;
    }
  }

  const layers = [];
  const visited = new Set();

  while (visited.size < nodeKeys.size) {
    const layer = [];

    for (const key of nodeKeys) {
      if (!visited.has(key) && inDegree[key] === 0) {
        layer.push(key);
      }
    }

    if (layer.length === 0) {
      // Cycle detected — collect remaining nodes
      break;
    }

    // Sort layer alphabetically for deterministic output
    layer.sort();

    for (const key of layer) {
      visited.add(key);
      for (const neighbor of adjacency[key]) {
        inDegree[neighbor]--;
      }
    }

    layers.push(layer);
  }

  // Detect cycles: remaining nodes with non-zero in-degree
  const cycles = [];
  const remaining = [];
  for (const key of nodeKeys) {
    if (!visited.has(key)) {
      remaining.push(key);
    }
  }

  if (remaining.length > 0) {
    // Find cycle members by tracing adjacency within remaining nodes
    const remainingSet = new Set(remaining);
    const cycleVisited = new Set();

    for (const start of remaining) {
      if (cycleVisited.has(start)) continue;
      const cycle = [];
      let current = start;
      const path = new Set();

      while (current && remainingSet.has(current) && !path.has(current)) {
        path.add(current);
        cycle.push(current);
        const next = adjacency[current].find(
          (n) => remainingSet.has(n) && !cycleVisited.has(n)
        );
        current = next;
      }

      if (cycle.length > 1) {
        cycles.push(cycle);
        for (const key of cycle) {
          cycleVisited.add(key);
        }
      }
    }

    // Add remaining nodes as a final layer (cycle-broken)
    remaining.sort();
    layers.push(remaining);
    for (const key of remaining) {
      visited.add(key);
    }
  }

  return { layers, cycles };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  let input = "";
  try {
    input = fs.readFileSync("/dev/stdin", "utf8");
  } catch {
    console.error(
      "Usage: node build-dependency-graph.js < all-tickets.json"
    );
    process.exit(1);
  }

  let tickets;
  try {
    tickets = JSON.parse(input);
  } catch (e) {
    console.error("Failed to parse JSON:", e.message);
    process.exit(1);
  }

  if (!Array.isArray(tickets)) {
    console.error("Input must be a JSON array of ticket objects");
    process.exit(1);
  }

  const { keys, edges, relatesToPairs, externalDeps } = buildGraph(tickets);
  const { layers, cycles } = topologicalSort(keys, edges);

  const warnings = [];

  if (cycles.length > 0) {
    warnings.push(
      `Detected ${cycles.length} cycle(s) involving: ${cycles.map((c) => c.join(" -> ")).join("; ")}. Cycle nodes placed in final layer.`
    );
  }

  // Check for bidirectional hard edges (potential data issue)
  const edgePairs = new Set();
  for (const edge of edges) {
    const reverse = `${edge.to}->${edge.from}`;
    if (edgePairs.has(reverse) && edge.type === "hard") {
      warnings.push(
        `Bidirectional hard edge detected: ${edge.from} <-> ${edge.to}. This may indicate a cycle or data issue.`
      );
    }
    edgePairs.add(`${edge.from}->${edge.to}`);
  }

  const output = {
    layers,
    edges,
    relatesToPairs,
    externalDeps,
    cycles,
    warnings,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
