// Shared by the API routes and the forms so the rules can't drift apart.
export const NAME_MIN = 2;
export const NAME_MAX = 80;

export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.replace(/\s+/g, " ").trim();
  return name.length >= NAME_MIN && name.length <= NAME_MAX ? name : null;
}

/** Parses YYYY-MM-DD (not in the future in Bangladesh time, not absurdly old) into a UTC-midnight Date. */
export function parseDateOnly(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  // Dates are Bangladesh calendar dates; an hour of slack covers clock skew, nothing more.
  if (v > dhakaDate(new Date(Date.now() + 60 * 60 * 1000))) return null;
  if (d.getUTCFullYear() < 1900) return null;
  return d;
}

export { todayIso } from "./dates";
import { dhakaDate } from "./dates";

export const DONATION_COUNT_MAX = 200;

/** "How many times have you donated?": "" / null -> null (not given), 0..200 -> the number, else undefined (invalid). */
export function parseDonationCount(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,3}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= DONATION_COUNT_MAX ? n : undefined;
}
