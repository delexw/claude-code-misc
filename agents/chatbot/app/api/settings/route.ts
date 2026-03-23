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
  writeSettings(settings);

  return Response.json(settings);
}
