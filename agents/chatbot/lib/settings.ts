import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { z } from "zod";
import { SETTINGS_FILE } from "@/lib/paths";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const repositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  githubRepo: z.string(),
});

export const globalSettingsSchema = z.object({
  version: z.literal(1),
  repositories: z.array(repositorySchema),
});

export type Repository = z.infer<typeof repositorySchema>;
export type GlobalSettings = z.infer<typeof globalSettingsSchema>;

// ─── Default ──────────────────────────────────────────────────────────────────

export function defaultSettings(): GlobalSettings {
  return { version: 1, repositories: [] };
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
