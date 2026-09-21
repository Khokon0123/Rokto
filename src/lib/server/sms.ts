import "server-only";
import { APP_NAME } from "@/config/app";
import { ApiError } from "./http";

const DEFAULT_BULKSMSBD_URL = "https://bulksmsbd.net/api/smsapi";

/**
 * Sends the OTP text. Provider is chosen with SMS_PROVIDER:
 *   "bulksmsbd" - real SMS through BulkSMSBD (non-masking, needs BULKSMSBD_API_KEY + BULKSMSBD_SENDER_ID)
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

  console.error(`Unknown SMS_PROVIDER "${provider}".`);
  throw new ApiError(503, "sms_unavailable");
}
