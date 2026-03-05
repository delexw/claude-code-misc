#!/usr/bin/env node
// Extracts JSON array or object from pd CLI output that may contain non-JSON text.
// Usage: <pd-command> | node extract-json.js
// Outputs clean JSON to stdout. Exits 0 on success, 1 on parse failure.

const chunks = [];
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  // Strip ANSI escape codes before processing
  const raw = chunks.join("").replace(/\x1b\[[0-9;]*m/g, "");

  // Check for empty-result messages
  if (/no\s+.+\s+found/i.test(raw) && !raw.includes("[") && !raw.includes("{")) {
    process.stdout.write("[]\n");
    process.exit(0);
  }

  // Find first [ or { and match to its closing bracket
  const arrStart = raw.indexOf("[");
  const objStart = raw.indexOf("{");

  let start = -1;
  let open, close;
  if (arrStart === -1 && objStart === -1) {
    process.stdout.write("[]\n");
    process.exit(0);
  } else if (arrStart === -1) {
    start = objStart;
    open = "{";
    close = "}";
  } else if (objStart === -1) {
    start = arrStart;
    open = "[";
    close = "]";
  } else {
    start = Math.min(arrStart, objStart);
    open = raw[start];
    close = open === "[" ? "]" : "}";
  }

  // Find matching close bracket (handle nesting)
  let depth = 0;
  let end = -1;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === open) depth++;
    else if (raw[i] === close) depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }

  if (end === -1) {
    process.stderr.write("Failed to find matching closing bracket\n");
    process.exit(1);
  }

  const jsonStr = raw.slice(start, end + 1);
  try {
    const parsed = JSON.parse(jsonStr);
    process.stdout.write(JSON.stringify(parsed) + "\n");
  } catch (e) {
    process.stderr.write(`JSON parse error: ${e.message}\n`);
    process.exit(1);
  }
});
