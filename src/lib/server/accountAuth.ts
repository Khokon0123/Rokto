import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ACCOUNT_SESSION_TTL_SECONDS } from "@/config/app";
import { isProduction } from "./env";
import { ApiError } from "./http";

// A account session is a signed cookie, not a database lookup: the header renders on every page and
// must not cost a read. The signature covers the session secret and ACCOUNT_SESSION_VERSION, so
// bumping the version signs everyone out at once.
//
// Suspension is deliberately NOT in the signature - it is per-account state that has to be able to
// take effect immediately. The reveal route reads the account and checks it there (phase 2).
//
// sameSite "lax", not "strict" like the admin cookie: a account who follows a shared /search link
// back into the site must still be signed in when they arrive.
export const ACCOUNT_COOKIE = "rokto_account";

export interface AccountSession {
  accountId: string;
  username: string;
}

/** ACCOUNT_SESSION_SECRET is the name; SEEKER_SESSION_SECRET is what the first deploy shipped with
 *  and is still honoured, so renaming it in the hosting dashboard is never an outage. */
export function sessionSecretValue(): string | undefined {
  return process.env.ACCOUNT_SESSION_SECRET || process.env.SEEKER_SESSION_SECRET;
}

function secret(): string {
  const s = sessionSecretValue();
  if (s && s.length >= 32) return s;
  if (!isProduction()) return "dev-only-account-secret-dev-only-account-secret";
  throw new ApiError(503, "server_error");
}

const version = () => process.env.ACCOUNT_SESSION_VERSION ?? process.env.SEEKER_SESSION_VERSION ?? "1";
const hmac = (data: string) => createHmac("sha256", secret()).update(data).digest();
const b64 = (buf: Buffer) => buf.toString("base64url");
const safeEqual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

export function signAccountSession(session: AccountSession, now = Date.now()): string {
  const payload = b64(
    Buffer.from(JSON.stringify({ sid: session.accountId, u: session.username, exp: now + ACCOUNT_SESSION_TTL_SECONDS * 1000 })),
  );
  return `${payload}.${b64(hmac(`account:${payload}:${version()}`))}`;
}

export function readAccountSession(token: string | undefined): AccountSession | null {
  if (!token || token.length > 1024) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    if (!safeEqual(hmac(`account:${payload}:${version()}`), Buffer.from(sig, "base64url"))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sid?: string; u?: string; exp?: number };
    if (!data.sid || !data.u || !data.exp || Date.now() > data.exp) return null;
    return { accountId: data.sid, username: data.u };
  } catch {
    return null;
  }
}

export function accountCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/", maxAge };
}

function cookieValue(req: Request): string | undefined {
  const cookie = req.headers.get("cookie") ?? "";
  return cookie.match(new RegExp(`(?:^|;\\s*)${ACCOUNT_COOKIE}=([^;]+)`))?.[1];
}

/** The signed-in account, or null. Never throws: most callers just render differently. */
export function currentAccount(req: Request): AccountSession | null {
  return readAccountSession(cookieValue(req));
}

/** For routes that are only for signed-in accounts. */
export function requireAccount(req: Request): AccountSession {
  const session = currentAccount(req);
  if (!session) throw new ApiError(401, "account_required");
  return session;
}
