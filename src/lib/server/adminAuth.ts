import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ADMIN_SESSION_TTL_SECONDS } from "@/config/app";
import { isProduction } from "./env";
import { isAdminUserActive } from "./adminUsers";
import { ApiError } from "./http";

// One shared admin password (owner decision #6: per-person accounts are the long-term option).
// A correct password gets a signed session in an httpOnly cookie. S7: the signature covers
//   - ADMIN_SESSION_SECRET (its own secret, not the OTP one),
//   - a hash of the CURRENT password, and
//   - ADMIN_SESSION_VERSION,
// so changing the password, or bumping the version, logs out every session everywhere.
export const ADMIN_COOKIE = "rokto_admin";

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (!isProduction()) return "dev-only-admin-secret-dev-only-admin-secret";
  throw new ApiError(503, "server_error");
}

const hmac = (data: string) => createHmac("sha256", secret()).update(data).digest();
const b64 = (buf: Buffer) => buf.toString("base64url");
const safeEqual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

function binding(): string {
  const pw = process.env.ADMIN_PASSWORD ?? "";
  const version = process.env.ADMIN_SESSION_VERSION ?? "1";
  return `${createHash("sha256").update(pw).digest("hex")}:${version}`;
}

const minPasswordLength = () => (isProduction() ? 16 : 8);

/** Constant-time password check (HMACs compared, so lengths don't leak through timing). */
export function checkAdminPassword(input: unknown): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < minPasswordLength()) return false;
  if (typeof input !== "string" || input.length === 0 || input.length > 512) return false;
  return safeEqual(hmac(`pw:${input}`), hmac(`pw:${password}`));
}

/** Who is signed in: a person's email, or the shared recovery password. */
export interface AdminIdentity {
  /** The admin's email, or null when they came in on the recovery password. */
  email: string | null;
}

/** What the audit trail records for this session. */
export const adminLabel = (who: AdminIdentity) => who.email ?? "recovery-password";

export function signAdminSession(who: AdminIdentity = { email: null }, now = Date.now()): string {
  const payload = b64(
    Buffer.from(JSON.stringify({ role: "admin", email: who.email, exp: now + ADMIN_SESSION_TTL_SECONDS * 1000 })),
  );
  return `${payload}.${b64(hmac(`admin:${payload}:${binding()}`))}`;
}

/** The identity in a valid session token, or null when it is missing, forged, expired or revoked. */
export function readAdminSession(token: string | undefined): AdminIdentity | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    if (!safeEqual(hmac(`admin:${payload}:${binding()}`), Buffer.from(sig, "base64url"))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      role?: string;
      email?: string | null;
      exp?: number;
    };
    if (data.role !== "admin" || !data.exp || Date.now() > data.exp) return null;
    return { email: typeof data.email === "string" ? data.email : null };
  } catch {
    return null;
  }
}

export const isValidAdminSession = (token: string | undefined): boolean => readAdminSession(token) !== null;

/** Like readAdminSession, but a person's login must also still exist and be enabled (revokes live sessions). */
export async function readAdminSessionLive(token: string | undefined): Promise<AdminIdentity | null> {
  const who = readAdminSession(token);
  if (who?.email && !(await isAdminUserActive(who.email))) return null;
  return who;
}

/** Cookie attributes used for BOTH login and logout, so logout always replaces the right cookie. */
export function adminCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: isProduction(), sameSite: "strict" as const, path: "/", maxAge };
}

/** The signed-in admin, or null. Never throws - the audit writer uses it before a cookie exists. */
export function currentAdmin(req: Request): AdminIdentity | null {
  const cookie = req.headers.get("cookie") ?? "";
  return readAdminSession(cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`))?.[1]);
}

/** Throws 401 if the request's admin cookie is missing, forged, expired or revoked. */
export async function requireAdmin(req: Request): Promise<AdminIdentity> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  const who = await readAdminSessionLive(match?.[1]);
  if (!who) throw new ApiError(401, "admin_unauthorized");
  return who;
}
