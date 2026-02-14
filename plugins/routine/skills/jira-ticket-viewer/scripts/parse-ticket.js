#!/usr/bin/env node

/**
 * Parse Jira issue raw JSON into structured JSON output.
 *
 * Usage:
 *   jira issue view ISSUE-KEY --raw | node parse-ticket.js
 *   node parse-ticket.js < /tmp/jira-raw.json > output.json
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
  const result = {
    key: data.key,
    summary: f.summary || null,
    type: f.issuetype?.name || null,
    status: f.status?.name || null,
    priority: f.priority?.name || null,
    resolution: f.resolution?.name || null,
    assignee: f.assignee?.displayName || null,
    reporter: f.reporter?.displayName || null,
    parent: null,
    sprint: null,
    created: formatDate(f.created),
    updated: formatDate(f.updated),
    dueDate: f.duedate || null,
    labels: f.labels && f.labels.length ? f.labels : [],
    components:
      f.components && f.components.length
        ? f.components.map((c) => c.name)
        : [],
  };

  if (f.parent) {
    result.parent = {
      key: f.parent.key,
      summary: f.parent.fields?.summary || null,
    };
  }

  const sprints = f.customfield_10020;
  if (sprints && sprints.length > 0) {
    const sprint = sprints[sprints.length - 1];
    result.sprint = { name: sprint.name, state: sprint.state };
  }

  return result;
}

function extractDescription(data) {
  const desc = data.fields.description;
  if (!desc) return null;
  return adfToMarkdown(desc) || null;
}

function collectAdfUrls(node) {
  if (!node || typeof node !== "object") return [];
  const urls = [];

  if (node.type === "inlineCard" && node.attrs?.url) {
    urls.push(node.attrs.url);
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      urls.push(...collectAdfUrls(child));
    }
  }

  return urls;
}

function categorizeUrl(url) {
  if (/atlassian\.net\/wiki\//.test(url)) return "confluence";
  if (/figma\.com\//.test(url)) return "figma";
  if (/github\.com\//.test(url)) return "github";
  return "other";
}

function extractLinks(data) {
  const links = {};

  // From customfield_10031 (design links)
  const designLinks = data.fields.customfield_10031;
  if (designLinks && designLinks.length > 0) {
    for (const link of designLinks) {
      const category = categorizeUrl(link.url);
      if (!links[category]) links[category] = [];
      links[category].push({
        url: link.url,
        displayName: link.displayName || null,
      });
    }
  }

  // From description inlineCard nodes
  const desc = data.fields.description;
  if (desc) {
    const descUrls = collectAdfUrls(desc);
    for (const url of descUrls) {
      const category = categorizeUrl(url);
      if (!links[category]) links[category] = [];
      // Avoid duplicates
      if (!links[category].some((l) => l.url === url)) {
        links[category].push({ url });
      }
    }
  }

  return links;
}

function extractAttachments(data) {
  const attachments = data.fields.attachment;
  if (!attachments || attachments.length === 0) return [];

  return attachments.map((att) => ({
    filename: att.filename,
    mimeType: att.mimeType,
    size: formatSize(att.size),
  }));
}

function extractIssueLinks(data) {
  const links = data.fields.issuelinks;
  if (!links || links.length === 0) return [];

  const result = [];
  for (const link of links) {
    if (link.outwardIssue) {
      const issue = link.outwardIssue;
      result.push({
        relationship: link.type.outward,
        key: issue.key,
        summary: issue.fields?.summary || null,
        status: issue.fields?.status?.name || null,
      });
    }
    if (link.inwardIssue) {
      const issue = link.inwardIssue;
      result.push({
        relationship: link.type.inward,
        key: issue.key,
        summary: issue.fields?.summary || null,
        status: issue.fields?.status?.name || null,
      });
    }
  }
  return result;
}

function extractComments(data) {
  const comments = data.fields.comment?.comments;
  if (!comments || comments.length === 0) return [];

  return comments.map((c) => ({
    author: c.author?.displayName || "Unknown",
    created: formatDate(c.created),
    body: c.body ? adfToMarkdown(c.body) : null,
  }));
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

  const output = {
    ...extractStandardFields(data),
    description: extractDescription(data),
    links: extractLinks(data),
    attachments: extractAttachments(data),
    linkedIssues: extractIssueLinks(data),
    comments: extractComments(data),
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
