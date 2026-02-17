/**
 * pd-client.js — Thin wrapper around the PagerDuty CLI (`pd`).
 * Handles command execution, retries, and JSON extraction from
 * stdout that may contain progress-message noise.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { parseJsonFromPdOutput } = require("./parse-pd");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function runPd(args) {
  const cmd = `pd ${args.join(" ")}`;
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = execSync(cmd, {
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 50 * 1024 * 1024,
      });
      return parseJsonFromPdOutput(raw);
    } catch (err) {
      lastError = err;
      console.error(
        `  [attempt ${attempt}/${MAX_RETRIES}] "${cmd}" failed: ${err.message}`
      );
      if (attempt < MAX_RETRIES) {
        execSync(`sleep ${RETRY_DELAY_MS / 1000}`);
      }
    }
  }
  throw new Error(`Failed after ${MAX_RETRIES} attempts: ${lastError.message}`);
}

function authenticate(token) {
  execSync(`pd auth add --token ${token}`, {
    encoding: "utf8",
    timeout: 30_000,
  });
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  OK: ${filePath}`);
}

module.exports = { runPd, authenticate, writeJson };
