import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { REVEAL_PASS_TTL_SECONDS } from "@/config/app";
import { secret } from "./otp";
import { sha256 } from "./keys";

// S2 "tap to reveal": after ONE solved CAPTCHA, the visitor gets a short signed pass (bound to
// their IP) so revealing a second or third donor in an emergency doesn't mean another challenge.
// Every reveal is still counted against the per-IP hourly/daily limits.

const sign = (payload: string) => createHmac("sha256", secret()).update(`reveal:${payload}`).digest("base64url");

export function issueRevealPass(ip: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ip: sha256(ip).slice(0, 16), exp: now + REVEAL_PASS_TTL_SECONDS * 1000 })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function checkRevealPass(pass: unknown, ip: string): boolean {
  if (typeof pass !== "string" || pass.length > 512) return false;
  const [payload, sig] = pass.split(".");
  if (!payload || !sig) return false;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { ip?: string; exp?: number };
    return data.ip === sha256(ip).slice(0, 16) && !!data.exp && Date.now() <= data.exp;
  } catch {
    return false;
  }
}
