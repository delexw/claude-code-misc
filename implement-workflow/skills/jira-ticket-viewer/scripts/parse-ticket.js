#!/usr/bin/env node

/**
 * Parse Jira issue raw JSON into structured readable output.
 *
 * Usage:
 *   jira issue view ISSUE-KEY --raw | node parse-ticket.js
 *   node parse-ticket.js < /tmp/jira-raw.json
 */

const fs = require("fs");

// ---------------------------------------------------------------------------
// ADF to Markdown converter
// ---------------------------------------------------------------------------

function adfToMarkdown(node, depth = 0) {
  if (!node) return "";
  if (typeof node === "string") return node;

  const { type, content, text, attrs } = node;

  switch (type) {
    case "doc":
      return (content || []).map((c) => adfToMarkdown(c, depth)).join("\n\n");

    case "paragraph":
      return (content || []).map((c) => adfToMarkdown(c, depth)).join("");

    case "text": {
      let result = text || "";
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === "strong") result = `**${result}**`;
          if (mark.type === "em") result = `*${result}*`;
          if (mark.type === "code") result = `\`${result}\``;
          if (mark.type === "link") result = `[${result}](${mark.attrs.href})`;
        }
      }
      return result;
    }

    case "heading": {
      const level = attrs?.level || 1;
      const prefix = "#".repeat(level);
      const body = (content || []).map((c) => adfToMarkdown(c, depth)).join("");
      return `${prefix} ${body}`;
    }

    case "bulletList":
      return (content || []).map((c) => adfToMarkdown(c, depth)).join("\n");

    case "orderedList":
      return (content || [])
        .map((c, i) => adfToMarkdown(c, depth, i + 1))
        .join("\n");

    case "listItem": {
      const indent = "  ".repeat(depth);
      const body = (content || [])
        .map((c) => adfToMarkdown(c, depth + 1))
        .join("\n");
      return `${indent}- ${body}`;
    }

    case "codeBlock": {
      const lang = attrs?.language || "";
      const body = (content || []).map((c) => adfToMarkdown(c, depth)).join("");
      return `\`\`\`${lang}\n${body}\n\`\`\``;
    }

    case "blockquote": {
      const body = (content || [])
        .map((c) => adfToMarkdown(c, depth))
        .join("\n");
      return body
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    }

    case "rule":
      return "---";

    case "table": {
      const rows = (content || []).map((row) =>
        (row.content || []).map((cell) =>
          (cell.content || []).map((c) => adfToMarkdown(c, depth)).join("")
        )
      );
      if (rows.length === 0) return "";
      const header = `| ${rows[0].join(" | ")} |`;
      const sep = `| ${rows[0].map(() => "---").join(" | ")} |`;
      const body = rows
        .slice(1)
        .map((r) => `| ${r.join(" | ")} |`)
        .join("\n");
      return [header, sep, body].filter(Boolean).join("\n");
    }

    case "mediaSingle":
    case "mediaGroup":
      return (content || []).map((c) => adfToMarkdown(c, depth)).join("\n");

    case "media": {
      const alt = attrs?.alt || attrs?.id || "media";
      const mediaType = attrs?.type || "file";
      return `[${mediaType}: ${alt}]`;
    }

    case "inlineCard": {
      const url = attrs?.url || "";
      return `[${url}](${url})`;
    }

    case "emoji":
      return attrs?.shortName || "";

    case "hardBreak":
      return "\n";

    case "mention":
      return `@${attrs?.text || attrs?.id || "user"}`;

    default:
      if (content) {
        return content.map((c) => adfToMarkdown(c, depth)).join("");
      }
      return "";
  }
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function formatDate(iso) {
  if (!iso) return null;
  return iso.replace(/T.*$/, "");
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function extractStandardFields(data) {
  const f = data.fields;
  const lines = [];

  lines.push(`${data.key}: ${f.summary}`);

  const meta = [];
  if (f.issuetype?.name) meta.push(`Type: ${f.issuetype.name}`);
  if (f.status?.name) meta.push(`Status: ${f.status.name}`);
  if (f.priority?.name) meta.push(`Priority: ${f.priority.name}`);
  if (f.resolution?.name) meta.push(`Resolution: ${f.resolution.name}`);
  if (meta.length) lines.push(meta.join(" | "));

  const people = [];
  if (f.assignee?.displayName)
    people.push(`Assignee: ${f.assignee.displayName}`);
  if (f.reporter?.displayName)
    people.push(`Reporter: ${f.reporter.displayName}`);
  if (people.length) lines.push(people.join(" | "));

  if (f.parent) {
    lines.push(
      `Parent/Epic: ${f.parent.key} — ${f.parent.fields?.summary || ""}`
    );
  }

  const sprints = f.customfield_10020;
  if (sprints && sprints.length > 0) {
    const sprint = sprints[sprints.length - 1];
    lines.push(`Sprint: ${sprint.name} (${sprint.state})`);
  }

  const dates = [];
  if (f.created) dates.push(`Created: ${formatDate(f.created)}`);
  if (f.updated) dates.push(`Updated: ${formatDate(f.updated)}`);
  if (f.duedate) dates.push(`Due: ${f.duedate}`);
  if (dates.length) lines.push(dates.join(" | "));

  if (f.labels && f.labels.length) {
    lines.push(`Labels: ${f.labels.join(", ")}`);
  }
  if (f.components && f.components.length) {
    lines.push(`Components: ${f.components.map((c) => c.name).join(", ")}`);
  }

  return lines.join("\n");
}

function extractDescription(data) {
  const desc = data.fields.description;
  if (!desc) return null;
  return adfToMarkdown(desc);
}

function extractDesignLinks(data) {
  const links = data.fields.customfield_10031;
  if (!links || links.length === 0) return null;

  const lines = ["Design Links:"];
  for (const link of links) {
    lines.push(`- ${link.displayName || "Design"}: ${link.url}`);
  }
  return lines.join("\n");
}

function extractAttachments(data) {
  const attachments = data.fields.attachment;
  if (!attachments || attachments.length === 0) return null;

  const lines = ["Attachments:"];
  for (const att of attachments) {
    lines.push(`- ${att.filename} (${att.mimeType}, ${formatSize(att.size)})`);
  }
  return lines.join("\n");
}

function extractIssueLinks(data) {
  const links = data.fields.issuelinks;
  if (!links || links.length === 0) return null;

  const lines = ["Linked Issues:"];
  for (const link of links) {
    if (link.outwardIssue) {
      const issue = link.outwardIssue;
      lines.push(
        `- ${link.type.outward}: ${issue.key} — ${issue.fields?.summary || ""} [${issue.fields?.status?.name || ""}]`
      );
    }
    if (link.inwardIssue) {
      const issue = link.inwardIssue;
      lines.push(
        `- ${link.type.inward}: ${issue.key} — ${issue.fields?.summary || ""} [${issue.fields?.status?.name || ""}]`
      );
    }
  }
  return lines.join("\n");
}

function extractComments(data) {
  const comments = data.fields.comment?.comments;
  if (!comments || comments.length === 0) return null;

  const lines = ["Comments:"];
  for (const c of comments) {
    const author = c.author?.displayName || "Unknown";
    const date = formatDate(c.created);
    const body = c.body ? adfToMarkdown(c.body) : "";
    lines.push(`- ${author} (${date}):\n  ${body.replace(/\n/g, "\n  ")}`);
  }
  return lines.join("\n");
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
      "Usage: jira issue view ISSUE-KEY --raw | node parse-ticket.js"
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

  const sections = [
    extractStandardFields(data),
    extractDescription(data)
      ? `\nDescription:\n${extractDescription(data)}`
      : null,
    extractDesignLinks(data) ? `\n${extractDesignLinks(data)}` : null,
    extractAttachments(data) ? `\n${extractAttachments(data)}` : null,
    extractIssueLinks(data) ? `\n${extractIssueLinks(data)}` : null,
    extractComments(data) ? `\n${extractComments(data)}` : null,
  ].filter(Boolean);

  console.log(sections.join("\n"));
}

main();
