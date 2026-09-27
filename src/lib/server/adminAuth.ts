import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ADMIN_SESSION_TTL_SECONDS } from "@/config/app";
import { ApiError } from "./http";

// One shared admin, one shared password (ADMIN_PASSWORD env var) - no accounts, nothing stored in
// Firestore. A correct password gets a signed, short-lived-ish session token in an httpOnly cookie;
// nothing else about "being logged in" is tracked anywhere.
export const ADMIN_COOKIE = "rokto_admin";

function secret(): string {
  // Reuses the same signing secret phone-OTP proofs already require, so there's no extra secret
  // to generate and keep safe. Domain-separated below (the "admin:" / "pw:" prefixes) so an admin
  // token can never be confused with (or forged from) an OTP proof.
  const s = process.env.OTP_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return "dev-only-secret-dev-only-secret-dev-only";
  throw new ApiError(503, "server_error");
}

const hmac = (data: string) => createHmac("sha256", secret()).update(data).digest();
const b64 = (buf: Buffer) => buf.toString("base64url");

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Constant-time password check. Comparing HMACs (not the raw strings) means the two inputs can be
 * different lengths without leaking that fact through timing, and the real password is never held
 * next to user input in a plain string compare.
 */
export function checkAdminPassword(input: unknown): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) return false; // refuse to run with a missing/weak password
  if (typeof input !== "string" || input.length === 0) return false;
  return safeEqual(hmac(`pw:${input}`), hmac(`pw:${password}`));
}

export function signAdminSession(): string {
  const payload = b64(
    Buffer.from(JSON.stringify({ role: "admin", exp: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000 })),
  );
  return `${payload}.${b64(hmac(`admin:${payload}`))}`;
}

export function isValidAdminSession(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  try {
    if (!safeEqual(hmac(`admin:${payload}`), Buffer.from(sig, "base64url"))) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      role?: string;
      exp?: number;
    };
    return data.role === "admin" && !!data.exp && Date.now() <= data.exp;
  } catch {
    return false;
  }
}

/** Throws 401 if the request's admin cookie is missing, forged or expired. */
export function requireAdmin(req: Request): void {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  if (!isValidAdminSession(match?.[1])) throw new ApiError(401, "admin_unauthorized");
}
