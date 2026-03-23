/**
 * GET    /api/settings/env-vars — List all environment variables (secret values fetched from keychain)
 * POST   /api/settings/env-vars — Add a new environment variable
 * PATCH  /api/settings/env-vars — Update an existing environment variable
 * DELETE /api/settings/env-vars — Remove an environment variable by id
 */

import { z } from "zod";
import { readSettings, writeSettings, makeEnvVar, isDovepawManaged } from "@/lib/settings";
import type { EnvVar } from "@/lib/settings";
import { getSecret, setSecret, deleteSecret, DOVEPAW_SERVICE } from "@/lib/keyring";

function resolveCoords(v: EnvVar) {
  return {
    service: v.keychainService ?? DOVEPAW_SERVICE,
    account: v.keychainAccount ?? v.key,
  };
}

function withSecretValues(envVars: EnvVar[]) {
  return envVars.map((v) => {
    if (!v.isSecret) return v;
    const { service, account } = resolveCoords(v);
    return { ...v, value: getSecret(service, account) ?? "" };
  });
}

export function GET() {
  const settings = readSettings();
  return Response.json({ envVars: withSecretValues(settings.envVars) });
}

const ENV_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

const postBodySchema = z.object({
  key: z.string().regex(ENV_KEY_RE, "Key must be SCREAMING_SNAKE_CASE (e.g. MY_TOKEN)"),
  value: z.string().default(""),
  isSecret: z.boolean().default(false),
  /** Provided when linking an existing external keychain entry. */
  keychainService: z.string().optional(),
  keychainAccount: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const settings = readSettings();
  const { key, value, isSecret, keychainService, keychainAccount } = parsed.data;

  if (settings.envVars.some((v) => v.key === key)) {
    return Response.json(
      { error: `Environment variable "${key}" already exists` },
      { status: 409 },
    );
  }

  // Only write to keychain when dovepaw is managing the entry (no external service specified)
  if (isSecret && !keychainService) {
    setSecret(DOVEPAW_SERVICE, key, value);
  }

  settings.envVars = [
    ...settings.envVars,
    makeEnvVar(key, value, isSecret, keychainService, keychainAccount),
  ];
  writeSettings(settings);

  return Response.json({ envVars: withSecretValues(settings.envVars) }, { status: 201 });
}

const patchBodySchema = z.object({
  id: z.string(),
  key: z.string().regex(ENV_KEY_RE, "Key must be SCREAMING_SNAKE_CASE (e.g. MY_TOKEN)"),
  value: z.string().default(""),
  isSecret: z.boolean().default(false),
  keychainService: z.string().optional(),
  keychainAccount: z.string().optional(),
});

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const settings = readSettings();
  const { id, key, value, isSecret, keychainService, keychainAccount } = parsed.data;
  const target = settings.envVars.find((v) => v.id === id);

  if (!target) {
    return Response.json({ error: "Environment variable not found" }, { status: 404 });
  }

  if (settings.envVars.some((v) => v.id !== id && v.key === key)) {
    return Response.json(
      { error: `Environment variable "${key}" already exists` },
      { status: 409 },
    );
  }

  // Remove the old dovepaw-managed entry if it was owned by us
  if (isDovepawManaged(target)) {
    const { service, account } = resolveCoords(target);
    deleteSecret(service, account);
  }

  // Write a new dovepaw-managed entry only when no external service is specified
  if (isSecret && !keychainService) {
    setSecret(DOVEPAW_SERVICE, key, value);
  }

  settings.envVars = settings.envVars.map((v) =>
    v.id === id
      ? {
          id,
          key: key.trim(),
          value: isSecret ? "" : value,
          isSecret,
          ...(keychainService
            ? { keychainService, keychainAccount: keychainAccount ?? key.trim() }
            : {}),
        }
      : v,
  );
  writeSettings(settings);

  return Response.json({ envVars: withSecretValues(settings.envVars) });
}

const deleteBodySchema = z.object({
  id: z.string(),
});

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const settings = readSettings();
  const target = settings.envVars.find((v) => v.id === parsed.data.id);

  if (!target) {
    return Response.json({ error: "Environment variable not found" }, { status: 404 });
  }

  // Only delete from keychain if dovepaw owns this entry
  if (isDovepawManaged(target)) {
    const { service, account } = resolveCoords(target);
    deleteSecret(service, account);
  }

  settings.envVars = settings.envVars.filter((v) => v.id !== parsed.data.id);
  writeSettings(settings);

  return Response.json({ envVars: withSecretValues(settings.envVars) });
}
