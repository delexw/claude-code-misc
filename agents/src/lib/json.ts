/**
 * Type-safe JSON.parse wrapper with validation.
 * Parses JSON and validates with the provided type guard.
 * Returns the typed value or null if validation fails.
 */
export function parseJson<T>(text: string, guard: (v: unknown) => v is T): T | null {
  try {
    const data: unknown = JSON.parse(text);
    return guard(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Parse JSON without validation — returns unknown.
 * Use when you need the raw parsed value and will narrow yourself.
 */
export function parseJsonRaw(text: string): unknown {
  return JSON.parse(text);
}
