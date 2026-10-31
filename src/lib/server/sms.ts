import "server-only";
import { APP_NAME } from "@/config/app";
import { isProduction } from "./env";
import { ApiError } from "./http";
import { log, maskPhone } from "./log";
import { otpMessage, parseAlpha, parseBulkSmsBd, parseBulkSmsDhaka, type ParseResult } from "./smsParsers";

const DEFAULT_BULKSMSBD_URL = "https://bulksmsbd.net/api/smsapi";
const DEFAULT_ALPHA_URL = "https://api.sms.net.bd/sendsms";
const DEFAULT_BULKSMSDHAKA_URL = "https://bulksmsdhaka.net/api/sendtext";

/**
 * Sends the OTP text. Provider is chosen with SMS_PROVIDER:
 *   "bulksmsdhaka" - Bulk SMS Dhaka (BULKSMSDHAKA_API_KEY; BULKSMSDHAKA_SENDER_ID optional)
 *   "alpha"        - Alpha SMS (ALPHA_SMS_API_KEY; ALPHA_SMS_SENDER_ID optional)
 *   "bulksmsbd"    - BulkSMSBD (BULKSMSBD_API_KEY + BULKSMSBD_SENDER_ID)
 *   "console"      - development only: logs that a code was "sent", sends nothing
 * SMS_DISABLED=true is an emergency kill switch: every send fails with sms_unavailable.
 */
export async function sendOtpSms(phoneE164: string, code: string, ttlMinutes: number, locale: "bn" | "en" = "en"): Promise<void> {
  if (process.env.SMS_DISABLED === "true") throw new ApiError(503, "sms_unavailable");
  const provider = process.env.SMS_PROVIDER ?? "console";
  const message = otpMessage({
    appName: APP_NAME,
    code,
    ttlMinutes,
    domain: siteDomain(),
    bangla: locale === "bn" && process.env.SMS_BANGLA === "true",
  });

  if (provider === "console") {
    if (isProduction()) throw new ApiError(503, "sms_unavailable");
    // Development only. The code goes to the terminal so testing needs no real SMS.
    console.info(`\n[DEV SMS] to ${phoneE164}: ${message}\n`);
    return;
  }

  const send = SENDERS[provider];
  if (!send) {
    log("error", "sms_unknown_provider", { provider });
    throw new ApiError(503, "sms_unavailable");
  }
  const result = await send(phoneE164.replace(/^\+/, ""), message);
  log(result.accepted ? "info" : "error", "sms_send", { provider, phone: maskPhone(phoneE164), ...result });
  if (!result.accepted) throw new ApiError(502, "sms_failed");
}

function siteDomain(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname : null;
  } catch {
    return null;
  }
}

type Sender = (number: string, message: string) => Promise<ParseResult>;

function requireEnv(...keys: string[]): string[] {
  const values = keys.map((k) => process.env[k] ?? "");
  const missing = keys.filter((_, i) => !values[i]);
  if (missing.length) {
    log("error", "sms_not_configured", { missing });
    throw new ApiError(503, "sms_unavailable");
  }
  return values;
}

/** Runs one HTTP call to a gateway; network failures and timeouts become a rejected result. */
async function call(url: string | URL, init: RequestInit, timeoutMs: number, redact: string[]): Promise<{ status: number; raw: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    return { status: res.status, raw: (await res.text()).trim() };
  } catch (e) {
    let msg = e instanceof Error ? e.message : String(e);
    for (const secret of redact) msg = msg.split(secret).join("***");
    log("error", "sms_request_failed", { message: msg.slice(0, 200) });
    throw new ApiError(502, "sms_failed");
  }
}

const form = (fields: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields),
});

const SENDERS: Record<string, Sender> = {
  async bulksmsbd(number, message) {
    const [apiKey, senderid] = requireEnv("BULKSMSBD_API_KEY", "BULKSMSBD_SENDER_ID");
    const fields = { api_key: apiKey, type: "text", number, senderid, message };
    const { status, raw } = await call(process.env.BULKSMSBD_API_URL ?? DEFAULT_BULKSMSBD_URL, form(fields), 10_000, [apiKey]);
    return parseBulkSmsBd(status, raw);
  },
  async alpha(number, message) {
    const [apiKey] = requireEnv("ALPHA_SMS_API_KEY");
    const fields: Record<string, string> = { api_key: apiKey, to: number, msg: message };
    if (process.env.ALPHA_SMS_SENDER_ID) fields.sender_id = process.env.ALPHA_SMS_SENDER_ID;
    const { status, raw } = await call(process.env.ALPHA_SMS_API_URL ?? DEFAULT_ALPHA_URL, form(fields), 10_000, [apiKey]);
    return parseAlpha(status, raw);
  },
  async bulksmsdhaka(number, message) {
    // This gateway documents GET with the key in the query string. The URL is never logged.
    const [apiKey] = requireEnv("BULKSMSDHAKA_API_KEY");
    const url = new URL(process.env.BULKSMSDHAKA_API_URL ?? DEFAULT_BULKSMSDHAKA_URL);
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("number", number);
    url.searchParams.set("message", message);
    if (process.env.BULKSMSDHAKA_SENDER_ID) url.searchParams.set("callerID", process.env.BULKSMSDHAKA_SENDER_ID);
    // 15s: this gateway has been seen taking ~9s to answer.
    const { status, raw } = await call(url, { method: "GET" }, 15_000, [apiKey]);
    return parseBulkSmsDhaka(status, raw);
  },
};
