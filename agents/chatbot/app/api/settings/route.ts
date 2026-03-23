/**
 * GET  /api/settings — Read global settings (watched repositories, etc.)
 * PUT  /api/settings — Replace the repositories list; returns updated settings
 */

import { z } from "zod";
import { readSettings, writeSettings, makeRepository } from "@/lib/settings";

export function GET() {
  return Response.json(readSettings());
}

const putBodySchema = z.object({
  repositories: z.array(z.object({ githubRepo: z.string() })),
});

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const settings = readSettings();
  settings.repositories = parsed.data.repositories.map((r) => makeRepository(r.githubRepo));

  // Cascade: remove deleted repo IDs from per-agent overrides
  const surviving = new Set(settings.repositories.map((r) => r.id));
  for (const agentName of Object.keys(settings.agentRepos)) {
    const filtered = settings.agentRepos[agentName].filter((id) => surviving.has(id));
    if (filtered.length === 0) {
      delete settings.agentRepos[agentName];
    } else {
      settings.agentRepos[agentName] = filtered;
    }
  }

  writeSettings(settings);

  return Response.json(settings);
}
