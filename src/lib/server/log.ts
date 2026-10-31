import "server-only";

// H3: one structured log line per event (JSON, so Vercel's log search and any drain can filter on
// fields), plus an optional alert webhook for things a human must see the same day.
// NEVER pass OTP codes, edit tokens, proofs, API keys or full phone numbers in here.

type Level = "info" | "warn" | "error";

/** +8801712345678 -> +880171****678. Enough to tell numbers apart in logs, not enough to call. */
export function maskPhone(phone: string): string {
  return phone.length > 7 ? `${phone.slice(0, 7)}****${phone.slice(-3)}` : "****";
}

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  log("error", event, { ...fields, message: message.slice(0, 500) });
}

/**
 * Sends a short text to ALERT_WEBHOOK_URL (Slack, Discord or Google Chat incoming webhook).
 * Best effort: an alert must never break the request that triggered it.
 */
export async function alert(text: string, fields: Record<string, unknown> = {}): Promise<void> {
  log("warn", "alert", { text, ...fields });
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[Rokto] ${text}`, content: `[Rokto] ${text}` }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (e) {
    logError("alert_failed", e);
  }
}
