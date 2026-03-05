#!/usr/bin/env node
// Extracts relevant fields from incident notes.
// Usage: cat raw-notes.json | node parse-notes.js
// Outputs extracted JSON array to stdout.

const chunks = [];
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const notes = JSON.parse(chunks.join(""));

  const extracted = (Array.isArray(notes) ? notes : []).map((note) => ({
    id: note.id,
    content: note.content,
    created_at: note.created_at || note.created || null,
    user: note.user?.summary || note.user?.name || note.added_by || null,
  }));

  process.stdout.write(JSON.stringify(extracted, null, 2) + "\n");
});
