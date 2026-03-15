/** Strip leading/trailing whitespace and markdown code fences from LLM output. */
function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");
}

/**
 * Type-safe JSON.parse wrapper with validation.
 * Strips code fences, parses JSON, and validates with the provided type guard.
 * Returns the typed value or null if validation fails.
 */
export function parseJson<T>(text: string, guard: (v: unknown) => v is T): T | null {
  try {
    const data: unknown = JSON.parse(stripCodeFence(text));
    return guard(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Parse JSON without validation — returns unknown.
 * Strips code fences before parsing.
 * Use when you need the raw parsed value and will narrow yourself.
 */
export function parseJsonRaw(text: string): unknown {
  return JSON.parse(stripCodeFence(text));
}
