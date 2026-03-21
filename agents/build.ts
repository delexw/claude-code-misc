#!/usr/bin/env tsx

/**
 * Build & install scheduler agents.
 *
 * Usage:
 *   npm run install-agents          # build + install + reload all agents
 *   npm run install-agents -- --uninstall   # unload + remove all agents
 */

import { execSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { agents } from "./plist/configs.js";
import { generatePlist, plistLabel } from "./plist/generate.js";
import { SCHEDULER_ROOT, SCHEDULER_LOGS } from "./lib/paths.js";

const HOME = process.env.HOME!;
const INSTALL_DIR = SCHEDULER_ROOT;
const LAUNCH_AGENTS_DIR = join(HOME, "Library/LaunchAgents");
const DIST_DIR = join(import.meta.dirname, "dist");
const uid = execSync("id -u").toString().trim();

const args = process.argv.slice(2);
const uninstall = args.includes("--uninstall");

function run(cmd: string, label: string): void {
  console.log(`  ${label}`);
  try {
    execSync(cmd, { stdio: "pipe" });
  } catch {
    // ignore errors (e.g., agent not loaded)
  }
}

// ─── Uninstall ──────────────────────────────────────────────────────────────

if (uninstall) {
  console.log(`Uninstalling all scheduler agents...\n`);
  for (const config of agents) {
    const label = plistLabel(config);
    const plistPath = join(LAUNCH_AGENTS_DIR, `${label}.plist`);
    run(`launchctl bootout gui/${uid} ${plistPath}`, `Unloading ${config.name}`);
    run(`launchctl bootout gui/${uid}/${config.label}`, `Unloading ${config.name} (by label)`);
    if (existsSync(plistPath)) {
      unlinkSync(plistPath);
      console.log(`  Removed ${plistPath}`);
    }
  }
  console.log(`\nDone. Scripts remain in ${SCHEDULER_ROOT}/ for manual use.`);
  process.exit(0);
}

// ─── Build ──────────────────────────────────────────────────────────────────

console.log("Step 1: Building TypeScript...\n");
execSync("npx tsup", { stdio: "inherit", cwd: import.meta.dirname });

// ─── Generate plists ────────────────────────────────────────────────────────

console.log("\nStep 2: Generating plist files (zsh login shell handles env)...\n");
mkdirSync(DIST_DIR, { recursive: true });

const targetAgents = agents;

for (const config of targetAgents) {
  const plistContent = generatePlist(config, HOME);
  const plistFile = join(DIST_DIR, `${plistLabel(config)}.plist`);
  writeFileSync(plistFile, plistContent);
  console.log(`  Generated ${plistLabel(config)}.plist`);
}

// ─── Install scripts ────────────────────────────────────────────────────────

console.log(`\nStep 3: Installing scripts to ${SCHEDULER_ROOT}/...\n`);
mkdirSync(INSTALL_DIR, { recursive: true });

for (const file of readdirSync(DIST_DIR)) {
  if (!file.endsWith(".mjs")) continue;
  const src = join(DIST_DIR, file);
  const dest = join(INSTALL_DIR, file);
  copyFileSync(src, dest);
  chmodSync(dest, 0o755);
  console.log(`  Installed ${file}`);
}

// Copy .envrc.example for reference
const envrcExample = join(import.meta.dirname, ".envrc.example");
if (existsSync(envrcExample)) {
  copyFileSync(envrcExample, join(INSTALL_DIR, ".envrc.example"));
}

// Copy native addon packages that cannot be bundled
const NATIVE_PACKAGES = ["@ladybugdb/core"];
for (const pkg of NATIVE_PACKAGES) {
  const src = join(import.meta.dirname, "node_modules", pkg);
  const dest = join(INSTALL_DIR, "node_modules", pkg);
  if (existsSync(src)) {
    mkdirSync(join(INSTALL_DIR, "node_modules"), { recursive: true });
    cpSync(src, dest, { recursive: true });
    console.log(`  Copied native package: ${pkg}`);
  }
}

// Check for .envrc
if (!existsSync(join(INSTALL_DIR, ".envrc"))) {
  console.log(`\n  WARNING: ${SCHEDULER_ROOT}/.envrc does not exist.`);
  console.log("  Copy .envrc.example and fill in your values:");
  console.log(`  cp ${INSTALL_DIR}/.envrc.example ${INSTALL_DIR}/.envrc`);
}

// ─── Install + reload plists ────────────────────────────────────────────────

console.log("\nStep 4: Installing and loading launch agents...\n");
mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });

for (const config of targetAgents) {
  const label = plistLabel(config);
  const plistSrc = join(DIST_DIR, `${label}.plist`);
  const plistDest = join(LAUNCH_AGENTS_DIR, `${label}.plist`);

  // Create log directories
  const logDir = join(SCHEDULER_LOGS, `.${config.name}`);
  mkdirSync(logDir, { recursive: true });

  // Unload existing (try both label formats: file path and human-readable label)
  run(`launchctl bootout gui/${uid} ${plistDest}`, `Unloading ${config.name}`);
  run(`launchctl bootout gui/${uid}/${config.label}`, `Unloading ${config.name} (by label)`);

  // Copy and load
  copyFileSync(plistSrc, plistDest);
  run(`launchctl bootstrap gui/${uid} ${plistDest}`, `Loading ${config.name}`);

  console.log(`  Installed ${label}.plist`);
}

// ─── Verify ─────────────────────────────────────────────────────────────────

console.log("\nStep 5: Verifying...\n");
for (const config of targetAgents) {
  try {
    const output = execSync("launchctl list", { stdio: "pipe" }).toString();
    if (output.includes(config.label)) {
      console.log(`  OK: ${config.name}`);
    } else {
      console.log(`  WARN: ${config.name} not loaded`);
    }
  } catch {
    console.log(`  WARN: ${config.name} not loaded`);
  }
}

console.log("\nDone!");
