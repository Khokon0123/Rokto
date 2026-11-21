// Shared by the browser form and the server, so the rule can't drift. Generated names
// (shanto-alo-4721) satisfy it too.
const USERNAME_RE = /^[a-z][a-z0-9_-]{2,23}$/;
// Names that would read as the Rokto team in the admin audit trail or a donor's history.
const RESERVED = new Set(["admin", "rokto", "support", "moderator", "root"]);

/** Trimmed, lower-cased username, or null if it is not an allowed one. */
export function normalizeUsername(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim().toLowerCase();
  return USERNAME_RE.test(v) && !RESERVED.has(v) ? v : null;
}
