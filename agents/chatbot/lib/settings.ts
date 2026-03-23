import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { z } from "zod";
import { SETTINGS_FILE } from "@/lib/paths";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const repositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  githubRepo: z.string(),
});

export const envVarSchema = z.object({
  id: z.string(),
  key: z.string(),
  /** Plain-text value for non-secret vars. Empty string for secrets (value lives in OS keychain). */
  value: z.string(),
  isSecret: z.boolean().default(false),
  /**
   * When set, this secret is a read-only link to an existing keychain entry owned by another app.
   * Dovepaw will never write or delete it.
   * When absent, the secret is dovepaw-managed (service="dovepaw", account=key).
   */
  keychainService: z.string().optional(),
  keychainAccount: z.string().optional(),
});

export const globalSettingsSchema = z.object({
  version: z.literal(1),
  repositories: z.array(repositorySchema),
  envVars: z.array(envVarSchema).default([]),
  /**
   * Per-agent repository overrides.
   * Key: agent name (e.g. "release-log-sentinel").
   * Value: array of enabled repository IDs.
   * When a key is absent, NO repositories are enabled for that agent (must opt in).
   */
  agentRepos: z.record(z.string(), z.array(z.string())).default({}),
});

export type Repository = z.infer<typeof repositorySchema>;
export type EnvVar = z.infer<typeof envVarSchema>;
export type GlobalSettings = z.infer<typeof globalSettingsSchema>;

// ─── Default ──────────────────────────────────────────────────────────────────

export function defaultSettings(): GlobalSettings {
  return { version: 1, repositories: [], envVars: [], agentRepos: {} };
}

// ─── Read / Write ─────────────────────────────────────────────────────────────

export function readSettings(): GlobalSettings {
  if (!existsSync(SETTINGS_FILE)) return defaultSettings();
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
    const parsed = globalSettingsSchema.safeParse(raw);
    return parsed.success ? parsed.data : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function writeSettings(settings: GlobalSettings): void {
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function makeRepository(githubRepo: string): Repository {
  const trimmed = githubRepo.trim();
  const name = trimmed.split("/").at(-1) ?? trimmed;
  return { id: crypto.randomUUID(), name, githubRepo: trimmed };
}

export function makeEnvVar(
  key: string,
  value: string,
  isSecret = false,
  keychainService?: string,
  keychainAccount?: string,
): EnvVar {
  const trimmedKey = key.trim();
  return {
    id: crypto.randomUUID(),
    key: trimmedKey,
    value: isSecret ? "" : value,
    isSecret,
    ...(keychainService ? { keychainService, keychainAccount: keychainAccount ?? trimmedKey } : {}),
  };
}

/** True when dovepaw owns this keychain entry (created it, can update/delete it). */
export function isDovepawManaged(envVar: EnvVar): boolean {
  return envVar.isSecret && !envVar.keychainService;
}
