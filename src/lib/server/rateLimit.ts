import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { ApiError } from "./http";

/**
 * Fixed-window counter in Firestore (private `rateLimits` collection). Throws 429 when the limit
 * is exceeded. Firestore transactions make concurrent requests count correctly.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const db = adminDb();
  const ref = db.collection("rateLimits").doc(createHash("sha256").update(key).digest("hex"));
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { count: number; windowStart: number } | undefined;
    if (!data || now - data.windowStart >= windowSeconds * 1000) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }
    if (data.count >= limit) throw new ApiError(429, "rate_limited");
    tx.update(ref, { count: data.count + 1 });
  });
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "unknown";
}
