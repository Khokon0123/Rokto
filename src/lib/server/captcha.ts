import "server-only";
import { allowedHostnames, isProduction } from "./env";
import { ApiError } from "./http";
import { log, logError } from "./log";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type CaptchaAction = "otp_send" | "reveal" | "report";

interface SiteVerify {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

/**
 * Cloudflare Turnstile check (S3, S12).
 * - Production: required. Missing keys -> 503, never a silent skip.
 * - Development: skipped when TURNSTILE_SECRET_KEY isn't set, so local testing works.
 * - The token must be for THIS site (hostname) and THIS form (action).
 * - Cloudflare down / 5xx -> 503 captcha_unavailable, not "you're a robot".
 */
export async function verifyCaptcha(token: unknown, ip: string, action: CaptchaAction): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (isProduction()) throw new ApiError(503, "captcha_unavailable");
    return;
  }
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) throw new ApiError(400, "captcha_failed");

  let data: SiteVerify;
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip && ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`siteverify HTTP ${res.status}`);
    data = (await res.json()) as SiteVerify;
  } catch (e) {
    logError("captcha_unreachable", e);
    throw new ApiError(503, "captcha_unavailable");
  }
  try {
    checkSiteVerify(data, action, allowedHostnames());
  } catch (e) {
    // Without this, every rejection reaches the user as "you look like a robot" and leaves no
    // trace of WHY: a wrong secret, a hostname Cloudflare doesn't recognise and a replayed token
    // are indistinguishable. None of these fields is a secret.
    log("warn", "captcha_rejected", {
      codes: data["error-codes"] ?? [],
      cfHostname: data.hostname ?? null,
      cfAction: data.action ?? null,
      expectedAction: action,
      allowedHostnames: allowedHostnames(),
    });
    throw e;
  }
}

/** Pure, so it can be unit tested: throws captcha_failed unless the answer is for us. */
export function checkSiteVerify(data: SiteVerify, action: CaptchaAction, hostnames: string[]): void {
  if (data.success !== true) throw new ApiError(400, "captcha_failed");
  // Hostnames are enforced whenever we know our own (always in production: NEXT_PUBLIC_SITE_URL).
  if (hostnames.length > 0 && (!data.hostname || !hostnames.includes(data.hostname))) {
    throw new ApiError(400, "captcha_failed");
  }
  if (data.action !== action) throw new ApiError(400, "captcha_failed");
}
