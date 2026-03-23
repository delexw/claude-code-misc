/**
 * GET  /api/settings/agent-repos?agent=<agentName>
 *   Returns { enabledRepoIds: string[] | null }
 *   null means the agent has no override → all repos are enabled.
 *
 * PUT  /api/settings/agent-repos
 *   Body: { agentName: string; enabledRepoIds: string[] }
 *   Saves the per-agent repo override. If enabledRepoIds equals all repo IDs,
 *   the override is removed (so the default "all enabled" applies).
 */

import { z } from "zod";
import { readSettings, writeSettings } from "@/lib/settings";

export function GET(request: Request) {
  const url = new URL(request.url);
  const agentName = url.searchParams.get("agent");
  if (!agentName) {
    return Response.json({ error: "Missing agent query param" }, { status: 400 });
  }
  const settings = readSettings();
  const enabledRepoIds = settings.agentRepos[agentName] ?? null;
  return Response.json({ enabledRepoIds });
}

const putBodySchema = z.object({
  agentName: z.string().min(1),
  enabledRepoIds: z.array(z.string()),
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

  const { agentName, enabledRepoIds } = parsed.data;
  const settings = readSettings();

  // If no repos are enabled, remove the override — absent key means "none enabled" (default)
  if (enabledRepoIds.length === 0) {
    delete settings.agentRepos[agentName];
  } else {
    settings.agentRepos[agentName] = enabledRepoIds;
  }

  writeSettings(settings);
  return Response.json({ enabledRepoIds: settings.agentRepos[agentName] ?? null });
}
