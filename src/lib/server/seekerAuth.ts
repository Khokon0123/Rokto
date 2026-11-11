import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SEEKER_SESSION_TTL_SECONDS } from "@/config/app";
import { isProduction } from "./env";
import { ApiError } from "./http";

// A seeker session is a signed cookie, not a database lookup: the header renders on every page and
// must not cost a read. The signature covers SEEKER_SESSION_SECRET and SEEKER_SESSION_VERSION, so
// bumping the version signs everyone out at once.
//
// Suspension is deliberately NOT in the signature - it is per-account state that has to be able to
// take effect immediately. The reveal route reads the account and checks it there (phase 2).
//
// sameSite "lax", not "strict" like the admin cookie: a seeker who follows a shared /search link
// back into the site must still be signed in when they arrive.
export const SEEKER_COOKIE = "rokto_seeker";

export interface SeekerSession {
  seekerId: string;
  username: string;
}

function secret(): string {
  const s = process.env.SEEKER_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (!isProduction()) return "dev-only-seeker-secret-dev-only-seeker-secret";
  throw new ApiError(503, "server_error");
}

const version = () => process.env.SEEKER_SESSION_VERSION ?? "1";
const hmac = (data: string) => createHmac("sha256", secret()).update(data).digest();
const b64 = (buf: Buffer) => buf.toString("base64url");
const safeEqual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

export function signSeekerSession(session: SeekerSession, now = Date.now()): string {
  const payload = b64(
    Buffer.from(JSON.stringify({ sid: session.seekerId, u: session.username, exp: now + SEEKER_SESSION_TTL_SECONDS * 1000 })),
  );
  return `${payload}.${b64(hmac(`seeker:${payload}:${version()}`))}`;
}

export function readSeekerSession(token: string | undefined): SeekerSession | null {
  if (!token || token.length > 1024) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    if (!safeEqual(hmac(`seeker:${payload}:${version()}`), Buffer.from(sig, "base64url"))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sid?: string; u?: string; exp?: number };
    if (!data.sid || !data.u || !data.exp || Date.now() > data.exp) return null;
    return { seekerId: data.sid, username: data.u };
  } catch {
    return null;
  }
}

export function seekerCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/", maxAge };
}

function cookieValue(req: Request): string | undefined {
  const cookie = req.headers.get("cookie") ?? "";
  return cookie.match(new RegExp(`(?:^|;\\s*)${SEEKER_COOKIE}=([^;]+)`))?.[1];
}

/** The signed-in seeker, or null. Never throws: most callers just render differently. */
export function currentSeeker(req: Request): SeekerSession | null {
  return readSeekerSession(cookieValue(req));
}

/** For routes that are only for signed-in seekers. */
export function requireSeeker(req: Request): SeekerSession {
  const session = currentSeeker(req);
  if (!session) throw new ApiError(401, "seeker_required");
  return session;
}
