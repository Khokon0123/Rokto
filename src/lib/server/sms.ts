import "server-only";
import { APP_NAME } from "@/config/app";
import { ApiError } from "./http";

const DEFAULT_BULKSMSBD_URL = "https://bulksmsbd.net/api/smsapi";
const DEFAULT_ALPHA_URL = "https://api.sms.net.bd/sendsms";
const DEFAULT_BULKSMSDHAKA_URL = "https://bulksmsdhaka.net/api/sendtext";

/**
 * Sends the OTP text. Provider is chosen with SMS_PROVIDER:
 *   "alpha"     - real SMS through Alpha SMS (needs ALPHA_SMS_API_KEY; ALPHA_SMS_SENDER_ID optional)
 *   "bulksmsbd" - real SMS through BulkSMSBD (non-masking, needs BULKSMSBD_API_KEY + BULKSMSBD_SENDER_ID)
 *   "bulksmsdhaka" - real SMS through Bulk SMS Dhaka (needs BULKSMSDHAKA_API_KEY;
 *                    BULKSMSDHAKA_SENDER_ID optional - non-masking sends from a random sender)
 *   "console"   - development only: prints the code in the terminal, sends nothing (free testing)
 * To use another Bangladeshi gateway later, add a branch here; nothing else needs to change.
 */
export async function sendOtpSms(phoneE164: string, code: string, ttlMinutes: number): Promise<void> {
  const message = `${APP_NAME}: your verification code is ${code}. It expires in ${ttlMinutes} minutes. Do not share it.`;
  const provider = process.env.SMS_PROVIDER ?? "console";

  if (provider === "console") {
    if (process.env.NODE_ENV === "production") {
      console.error("SMS_PROVIDER=console is not allowed in production.");
      throw new ApiError(503, "sms_unavailable");
    }
    console.log(`\n[DEV SMS] to ${phoneE164}: ${message}\n`);
    return;
  }

  if (provider === "bulksmsbd") {
    const apiKey = process.env.BULKSMSBD_API_KEY;
    const senderId = process.env.BULKSMSBD_SENDER_ID;
    if (!apiKey || !senderId) {
      console.error("BULKSMSBD_API_KEY / BULKSMSBD_SENDER_ID are not set.");
      throw new ApiError(503, "sms_unavailable");
    }
    // POST (not GET) so the API key never lands in URLs or request logs. BulkSMSBD wants 8801XXXXXXXXX.
    const body = new URLSearchParams({
      api_key: apiKey,
      type: "text",
      number: phoneE164.replace(/^\+/, ""),
      senderid: senderId,
      message,
    });
    let result: { response_code?: number | string } = {};
    try {
      const res = await fetch(process.env.BULKSMSBD_API_URL ?? DEFAULT_BULKSMSBD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      result = (await res.json().catch(() => ({}))) as typeof result;
    } catch (e) {
      console.error("BulkSMSBD request failed", e);
      throw new ApiError(502, "sms_failed");
    }
    // 202 = submitted. Others: 1002 bad sender id, 1007 no balance, etc. Never log the code or the key.
    if (Number(result.response_code) !== 202) {
      console.error("BulkSMSBD rejected the SMS, response_code:", result.response_code);
      throw new ApiError(502, "sms_failed");
    }
    return;
  }

  if (provider === "alpha") {
    const apiKey = process.env.ALPHA_SMS_API_KEY;
    const senderId = process.env.ALPHA_SMS_SENDER_ID; // optional - falls back to Alpha's default sender
    if (!apiKey) {
      console.error("ALPHA_SMS_API_KEY is not set.");
      throw new ApiError(503, "sms_unavailable");
    }
    // POST (not GET) so the API key never lands in URLs or request logs. Alpha wants 8801XXXXXXXXX.
    const body = new URLSearchParams({
      api_key: apiKey,
      to: phoneE164.replace(/^\+/, ""),
      msg: message,
    });
    if (senderId) body.set("sender_id", senderId);
    let result: { error?: number | string; msg?: string } = {};
    try {
      const res = await fetch(process.env.ALPHA_SMS_API_URL ?? DEFAULT_ALPHA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      result = (await res.json().catch(() => ({}))) as typeof result;
    } catch (e) {
      console.error("Alpha SMS request failed", e);
      throw new ApiError(502, "sms_failed");
    }
    // error 0 = submitted. Anything else (bad key, no balance, unapproved sender, ...) is a failure.
    // Never log the code or the key.
    if (Number(result.error) !== 0) {
      console.error("Alpha SMS rejected the SMS, error:", result.error, result.msg);
      throw new ApiError(502, "sms_failed");
    }
    return;
  }

  if (provider === "bulksmsdhaka") {
    const apiKey = process.env.BULKSMSDHAKA_API_KEY;
    const senderId = process.env.BULKSMSDHAKA_SENDER_ID; // optional: non-masking sends from a random sender
    if (!apiKey) {
      console.error("BULKSMSDHAKA_API_KEY is not set.");
      throw new ApiError(503, "sms_unavailable");
    }
    // This gateway documents GET with the key in the query string - unlike the two above, which
    // take POST. The URL is never logged anywhere below, and anything we do log is redacted.
    const url = new URL(process.env.BULKSMSDHAKA_API_URL ?? DEFAULT_BULKSMSDHAKA_URL);
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("number", phoneE164.replace(/^\+/, "")); // wants 8801XXXXXXXXX
    url.searchParams.set("message", message);
    if (senderId) url.searchParams.set("callerID", senderId);

    const redact = (text: string) => text.split(apiKey).join("***");
    let raw = "";
    let httpStatus = 0;
    try {
      // 15s, not 10s: this gateway has been seen taking ~9s to answer.
      const res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      httpStatus = res.status;
      raw = (await res.text()).trim();
    } catch (e) {
      console.error("Bulk SMS Dhaka request failed:", redact(e instanceof Error ? e.message : String(e)));
      throw new ApiError(502, "sms_failed");
    }

    // Gateways in this market answer inconsistently: JSON ({"Status":"1000"}), a bare numeric
    // code, or a sentence. Read the body as text and accept any of those rather than assuming
    // one shape - and if it is a rejection, log the body verbatim so the reason is visible.
    let code = raw;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      code = String(parsed.Status ?? parsed.status ?? parsed.code ?? parsed.response_code ?? raw);
    } catch {
      /* not JSON - fall back to the raw text */
    }
    // 1000 = accepted. Others include 1005 (flagged as spam) and 2001 (no balance).
    const accepted = /(^|\D)1000(\D|$)/.test(code) || /success/i.test(code);
    if (!accepted) {
      // Truncated and key-redacted; the OTP itself is never part of the response.
      console.error(`Bulk SMS Dhaka rejected the SMS (HTTP ${httpStatus}):`, redact(raw.slice(0, 300)) || "(empty body)");
      throw new ApiError(502, "sms_failed");
    }
    return;
  }

  console.error(`Unknown SMS_PROVIDER "${provider}".`);
  throw new ApiError(503, "sms_unavailable");
}
