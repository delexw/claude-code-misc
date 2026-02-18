#!/usr/bin/env node
/**
 * fetch-pd.js — Orchestrator that runs all PagerDuty CLI commands,
 * filters by configured escalation policies, and saves parsed JSON
 * files to the output directory.
 *
 * Usage:
 *   node fetch-pd.js <outdir> [since] [until]
 *
 * Arguments:
 *   outdir  — Directory for all output files (created automatically)
 *   since   — Start date YYYY-MM-DD (defaults to today)
 *   until   — End date YYYY-MM-DD (defaults to today)
 *
 * Environment:
 *   PAGEDUTY_API_TOKEN — PagerDuty REST API token (required)
 */

const fs = require("fs");
const path = require("path");
const { parsers } = require("./parse-pd");
const { runPd, authenticate, writeJson } = require("./pd-client");

const SCRIPT_DIR = path.resolve(__dirname, "..");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  const outdir = process.argv[2];
  if (!outdir) {
    console.error("Usage: node fetch-pd.js <outdir> [since] [until]");
    process.exit(1);
  }
  const since = process.argv[3] || today();
  const until = process.argv[4] || today();

  // Create output directories
  for (const sub of ["logs", "notes", "analytics"]) {
    fs.mkdirSync(path.join(outdir, sub), { recursive: true });
  }

  // Load config: config.json → PD_ESCALATION_POLICIES env → []
  const configPath = path.join(SCRIPT_DIR, "config.json");
  let targetEpNames = [];
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    targetEpNames = config.escalation_policies ?? [];
  } catch {
    // config.json missing or invalid, will fall back to env
  }
  if (targetEpNames.length === 0 && process.env.PD_ESCALATION_POLICIES) {
    targetEpNames = process.env.PD_ESCALATION_POLICIES.split(",").map((s) => s.trim()).filter(Boolean);
  }

  // 1. Authenticate (skip if already authenticated and no token provided)
  const token = process.env.PAGEDUTY_API_TOKEN;
  if (token) {
    console.log("==> Authenticating with token...");
    try {
      authenticate(token);
      console.log("  OK: authenticated");
    } catch (err) {
      console.error(`Authentication failed: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log("==> No PAGEDUTY_API_TOKEN set, using existing pd auth...");
  }

  // 2. List escalation policies
  console.log("==> Listing escalation policies...");
  const rawEps = runPd(["ep", "list", "--json"]);
  const allEps = parsers.ep(rawEps);
  writeJson(path.join(outdir, "ep-list.json"), allEps);

  let targetEps;
  if (targetEpNames.length > 0) {
    const namesLower = targetEpNames.map((n) => n.toLowerCase());
    targetEps = allEps.filter(
      (ep) => ep.name && namesLower.includes(ep.name.toLowerCase())
    );
    console.log(
      `  Filtered to ${targetEps.length} target EPs: ${targetEps.map((e) => e.name).join(", ")}`
    );
  } else {
    targetEps = allEps;
    console.log(`  No EP filter configured, using all ${targetEps.length} EPs`);
  }
  const targetEpIds = new Set(targetEps.map((ep) => ep.id));

  // 3. List incidents
  console.log(`==> Listing incidents (${since} to ${until})...`);
  const rawIncidents = runPd([
    "incident", "list", "--json",
    "--statuses=open", "--statuses=closed",
    "--statuses=triggered", "--statuses=acknowledged", "--statuses=resolved",
    `--since=${since}`, `--until=${until}`,
  ]);
  const allIncidents = parsers.incident(rawIncidents);

  const incidents = allIncidents.filter(
    (inc) => inc.escalation_policy && targetEpIds.has(inc.escalation_policy.id)
  );
  writeJson(path.join(outdir, "incidents.json"), incidents);
  console.log(
    `  Found ${allIncidents.length} total, ${incidents.length} matching target EPs`
  );

  if (incidents.length === 0) {
    console.log("==> No matching incidents found. Done.");
    writeJson(path.join(outdir, "summary.json"), {
      since, until,
      target_eps: targetEps.map((e) => ({ id: e.id, name: e.name })),
      incident_count: 0,
      incidents: [],
    });
    process.exit(0);
  }

  // 4. Gather details per incident (sequentially to avoid rate limits)
  console.log(`==> Gathering details for ${incidents.length} incidents...`);
  const errors = [];

  for (const inc of incidents) {
    const id = inc.id;

    console.log(`  [${id}] log...`);
    try {
      const raw = runPd(["incident", "log", "-i", id, "--json"]);
      writeJson(path.join(outdir, "logs", `${id}.json`), parsers.log(raw));
    } catch (err) {
      console.error(`  [${id}] log FAILED: ${err.message}`);
      writeJson(path.join(outdir, "logs", `${id}.json`), []);
      errors.push({ incident: id, type: "log", error: err.message });
    }

    console.log(`  [${id}] notes...`);
    try {
      const raw = runPd(["incident", "notes", "-i", id, "--output=json"]);
      writeJson(path.join(outdir, "notes", `${id}.json`), parsers.notes(raw));
    } catch (err) {
      console.error(`  [${id}] notes FAILED: ${err.message}`);
      writeJson(path.join(outdir, "notes", `${id}.json`), []);
      errors.push({ incident: id, type: "notes", error: err.message });
    }

    console.log(`  [${id}] analytics...`);
    try {
      const raw = runPd(["incident", "analytics", "-i", id, "--json"]);
      writeJson(path.join(outdir, "analytics", `${id}.json`), parsers.analytics(raw));
    } catch (err) {
      console.error(`  [${id}] analytics FAILED: ${err.message}`);
      writeJson(path.join(outdir, "analytics", `${id}.json`), []);
      errors.push({ incident: id, type: "analytics", error: err.message });
    }
  }

  // 5. Write summary
  const summary = {
    since, until,
    target_eps: targetEps.map((e) => ({ id: e.id, name: e.name })),
    incident_count: incidents.length,
    incidents: incidents.map((i) => i.id),
    errors: errors.length > 0 ? errors : undefined,
  };
  writeJson(path.join(outdir, "summary.json"), summary);

  console.log(`\n==> Done. ${incidents.length} incidents processed.`);
  if (errors.length > 0) {
    console.log(`  ${errors.length} errors occurred (see summary.json).`);
  }
}

main();
