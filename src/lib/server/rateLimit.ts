import "server-only";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { isProduction } from "./env";
import { ApiError } from "./http";

const COLLECTION = "rateLimits";
const keyRef = (key: string) => adminDb().collection(COLLECTION).doc(createHash("sha256").update(key).digest("hex"));

/**
 * Fixed-window counter in Firestore (private `rateLimits` collection). Throws 429 (or `code`) when
 * the limit is reached. Each doc carries `expireAt` (a Timestamp) so a Firestore TTL policy can
 * delete old windows (D5). A limit of 0 blocks everything.
 */
export async function hit(key: string, limit: number, windowSeconds: number, code = "rate_limited"): Promise<number> {
  const db = adminDb();
  const ref = keyRef(key);
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { count: number; windowStart: number } | undefined;
    const fresh = !data || now - data.windowStart >= windowSeconds * 1000;
    const count = fresh ? 0 : data.count;
    if (count >= limit) throw new ApiError(429, code);
    const windowStart = fresh ? now : data.windowStart;
    tx.set(ref, {
      count: count + 1,
      windowStart,
      expireAt: Timestamp.fromMillis(windowStart + windowSeconds * 1000),
    });
    return count + 1;
  });
}

/** Read-only check: throws if the counter is already at its limit, without counting this request. */
export async function check(key: string, limit: number, windowSeconds: number, code = "rate_limited"): Promise<void> {
  const snap = await keyRef(key).get();
  const data = snap.data() as { count: number; windowStart: number } | undefined;
  if (!data || Date.now() - data.windowStart >= windowSeconds * 1000) {
    if (limit <= 0) throw new ApiError(429, code);
    return;
  }
  if (data.count >= limit) throw new ApiError(429, code);
}

/** Gives one unit back, e.g. when the SMS provider refused a text we had counted (S3). */
export async function refund(key: string): Promise<void> {
  const db = adminDb();
  const ref = keyRef(key);
  await db
    .runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = (snap.data()?.count as number | undefined) ?? 0;
      if (count > 0) tx.update(ref, { count: count - 1 });
    })
    .catch(() => undefined);
}

/**
 * S8: the client IP, from a header only our own edge can set. On Vercel that's x-real-ip (Vercel
 * overwrites it; a visitor can't forge it). Elsewhere set TRUSTED_IP_HEADER to the header your
 * proxy controls (e.g. cf-connecting-ip behind Cloudflare). X-Forwarded-For is never trusted by
 * default, because any client can send its own first entry. Unknown = one shared, strict bucket.
 */
export function clientIp(req: Request): string {
  const header = (process.env.TRUSTED_IP_HEADER || (process.env.VERCEL ? "x-real-ip" : "")).toLowerCase();
  if (header) {
    const value = req.headers.get(header)?.split(",")[0]?.trim();
    if (value) return value;
  }
  // Local development and tests: no proxy in front, so there is nothing trustworthy to read.
  if (!isProduction()) return req.headers.get("x-real-ip")?.trim() || "dev";
  return "unknown";
}

/** /24 for IPv4, /48 for IPv6: one household or small network, for coarser daily limits. */
export function subnetOf(ip: string): string {
  if (ip.includes(".")) return ip.split(".").slice(0, 3).join(".") + ".0/24";
  if (ip.includes(":")) {
    // Expand "::" first, so "2001:db8::1" and "2001:db8:0:0:0:0:0:1" give the same /48.
    const [head, tail] = ip.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    const groups = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
    return groups.slice(0, 3).join(":") + "::/48";
  }
  return ip;
}
