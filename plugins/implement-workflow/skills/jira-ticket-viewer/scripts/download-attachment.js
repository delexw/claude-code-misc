#!/usr/bin/env node

/**
 * Download Jira issue attachments via the REST API.
 *
 * Reads raw JSON from stdin (piped from `jira issue view --raw`).
 *
 * Usage:
 *   jira issue view ISSUE-KEY --raw | node download-attachment.js [--out <dir>]
 *   node download-attachment.js [--out <dir>] < /tmp/jira-raw.json
 *
 * Environment:
 *   JIRA_API_TOKEN  - Jira API token (required)
 *   JIRA_EMAIL      - Jira account email (default: read from jira-cli config)
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : "/tmp";

const apiToken = process.env.JIRA_API_TOKEN;
if (!apiToken) {
  console.error("Error: JIRA_API_TOKEN environment variable is not set.");
  process.exit(1);
}

// Try to read email from jira-cli config if not provided via env
function readJiraConfig() {
  try {
    const configPath = path.join(
      process.env.HOME,
      ".config",
      ".jira",
      ".config.yml"
    );
    const raw = fs.readFileSync(configPath, "utf8");
    const config = {};
    for (const line of raw.split("\n")) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) config[match[1]] = match[2].trim();
    }
    return config;
  } catch {
    return {};
  }
}

const jiraConfig = readJiraConfig();
const email = process.env.JIRA_EMAIL || jiraConfig.login;

if (!email) {
  console.error(
    "Error: Could not determine Jira email. Set JIRA_EMAIL env var or configure jira-cli."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fetchUrl(url, headers) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod
      .get(url, { headers }, (res) => {
        // Follow redirects
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return fetchUrl(res.headers.location, headers).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () =>
            reject(new Error(`HTTP ${res.statusCode}: ${body}`))
          );
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

async function downloadAttachment(attachment, destDir) {
  const authHeader =
    "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64");

  const headers = {
    Authorization: authHeader,
    "X-Atlassian-Token": "no-check",
  };

  const buffer = await fetchUrl(attachment.content, headers);
  const destPath = path.join(destDir, attachment.filename);
  fs.writeFileSync(destPath, buffer);
  return destPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let input = "";
  try {
    input = fs.readFileSync("/dev/stdin", "utf8");
  } catch {
    console.error(
      "Usage: jira issue view ISSUE-KEY --raw | node download-attachment.js [--out <dir>]"
    );
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    console.error("Failed to parse JSON:", e.message);
    process.exit(1);
  }

  const attachments = data.fields?.attachment || [];
  const issueKey = data.key || "unknown";

  if (attachments.length === 0) {
    console.log("No attachments found.");
    process.exit(0);
  }

  console.log(`Found ${attachments.length} attachment(s) for ${issueKey}.`);

  const dest = outDir.includes(issueKey)
    ? outDir
    : path.join(outDir, issueKey);
  fs.mkdirSync(dest, { recursive: true });

  for (const att of attachments) {
    console.log(`  Downloading: ${att.filename} (${att.size} bytes)...`);
    try {
      const destPath = await downloadAttachment(att, dest);
      console.log(`  Saved to: ${destPath}`);
    } catch (err) {
      console.error(`  Failed to download ${att.filename}: ${err.message}`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
