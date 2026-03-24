#!/usr/bin/env node

/**
 * Fetch pull requests linked to a Jira issue via the dev-status API.
 *
 * Usage:
 *   node fetch-pull-requests.js < OUT_DIR/raw.json > OUT_DIR/pull-requests.json
 *
 * Required env vars:
 *   JIRA_SERVER      — e.g. https://envato.atlassian.net
 *   JIRA_API_TOKEN   — Jira API token
 *   JIRA_EMAIL       — Jira account email (falls back to `jira me` output)
 */

const fs = require("fs");
const https = require("https");
const { execSync } = require("child_process");

function getEmail() {
  if (process.env.JIRA_EMAIL) return process.env.JIRA_EMAIL.trim();
  try {
    return execSync("jira me", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        } else {
          resolve(body);
        }
      });
    });
    req.on("error", reject);
  });
}

async function main() {
  let input = "";
  try {
    input = fs.readFileSync("/dev/stdin", "utf8");
  } catch {
    console.error("Usage: jira issue view ISSUE-KEY --raw | node fetch-pull-requests.js");
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    console.error("Failed to parse JSON:", e.message);
    process.exit(1);
  }

  const issueId = data.id;
  if (!issueId) {
    console.log(JSON.stringify([]));
    return;
  }

  const server = (process.env.JIRA_SERVER || "").replace(/\/$/, "");
  const token = process.env.JIRA_API_TOKEN || "";
  const email = getEmail();

  if (!server || !token || !email) {
    const missing = [!server && "JIRA_SERVER", !token && "JIRA_API_TOKEN", !email && "email"].filter(Boolean);
    console.error(`Missing: ${missing.join(", ")} — skipping PR fetch`);
    console.log(JSON.stringify([]));
    return;
  }

  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const url = `${server}/rest/dev-status/1.0/issue/detail?issueId=${issueId}&applicationType=GitHub&dataType=pullrequest`;

  let body;
  try {
    body = await httpsGet(url, {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    });
  } catch (e) {
    console.error("PR fetch failed:", e.message);
    console.log(JSON.stringify([]));
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    console.log(JSON.stringify([]));
    return;
  }

  const pullRequests = [];
  for (const detail of parsed.detail || []) {
    for (const pr of detail.pullRequests || []) {
      pullRequests.push({
        id: pr.id,
        title: pr.name,
        url: pr.url,
        status: pr.status,
        sourceBranch: pr.source?.branch || null,
        targetBranch: pr.destination?.branch || null,
        repository: pr.repositoryName || null,
        author: pr.author?.name || null,
        commentCount: pr.commentCount ?? null,
        lastUpdate: pr.lastUpdate ? pr.lastUpdate.replace(/T.*$/, "") : null,
      });
    }
  }

  console.log(JSON.stringify(pullRequests, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
