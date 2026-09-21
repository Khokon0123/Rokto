// Shared by the API routes and the forms so the rules can't drift apart.
export const NAME_MIN = 2;
export const NAME_MAX = 80;

export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.replace(/\s+/g, " ").trim();
  return name.length >= NAME_MIN && name.length <= NAME_MAX ? name : null;
}

/** Parses YYYY-MM-DD (not in the future, not absurdly old) into a UTC-midnight Date. */
export function parseDateOnly(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  const now = Date.now();
  if (d.getTime() > now + 24 * 60 * 60 * 1000) return null; // allow timezone slack
  if (d.getUTCFullYear() < 1900) return null;
  return d;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
