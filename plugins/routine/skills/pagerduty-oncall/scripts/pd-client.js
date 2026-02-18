/**
 * pd-client.js — Thin wrapper around the PagerDuty CLI (`pd`).
 * Handles command execution, retries, and JSON extraction from
 * stdout that may contain progress-message noise.
 *
 * Uses file-based output to avoid Node.js pipe buffer truncation
 * at 8192 bytes for large pd CLI responses.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseJsonFromPdOutput } = require("./parse-pd");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function runPd(args) {
  const cmd = `pd ${args.join(" ")}`;
  const tmpFile = path.join(os.tmpdir(), `pd-out-${process.pid}-${Date.now()}.json`);
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Redirect stdout to temp file to bypass pipe buffer truncation
      execSync(`${cmd} > "${tmpFile}" 2>&1`, {
        encoding: "utf8",
        timeout: 120_000,
        shell: true,
      });
    } catch (err) {
      // pd CLI may write error to file or stderr
      const fileContent = fs.existsSync(tmpFile)
        ? fs.readFileSync(tmpFile, "utf8")
        : "";
      const output = fileContent + (err.stdout || "") + (err.stderr || "");
      if (/no .+ found/i.test(output)) {
        cleanup(tmpFile);
        return [];
      }
      lastError = err;
      console.error(
        `  [attempt ${attempt}/${MAX_RETRIES}] "${cmd}" failed: ${err.message}`
      );
      if (attempt < MAX_RETRIES) {
        execSync(`sleep ${RETRY_DELAY_MS / 1000}`);
      }
      continue;
    }

    let raw;
    try {
      raw = fs.readFileSync(tmpFile, "utf8");
    } catch {
      lastError = new Error("Could not read temp output file");
      continue;
    }

    // pd CLI may exit 0 with empty stdout when no results found
    if (!raw.trim()) {
      cleanup(tmpFile);
      return [];
    }

    try {
      const result = parseJsonFromPdOutput(raw);
      cleanup(tmpFile);
      return result;
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

  cleanup(tmpFile);
  throw new Error(`Failed after ${MAX_RETRIES} attempts: ${lastError.message}`);
}

function cleanup(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {}
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
