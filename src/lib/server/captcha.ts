import "server-only";
import { ApiError } from "./http";

/**
 * Optional Cloudflare Turnstile (free) check. Enabled only when TURNSTILE_SECRET_KEY is set,
 * so local development works without it. Protects the SMS-sending endpoint from bots.
 */
export async function verifyCaptcha(token: unknown, ip: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (typeof token !== "string" || token.length < 10) throw new ApiError(400, "captcha_failed");
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) throw new ApiError(400, "captcha_failed");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "captcha_failed");
  }
}
