// Pure response parsers for each SMS gateway (M1, M2). No I/O, so every edge case is unit tested.
// Each takes the HTTP status and raw body text and says whether the gateway ACCEPTED the message.
// Anything not exactly matching the documented success shape is a failure.

export interface ParseResult {
  accepted: boolean;
  /** Short, already-safe description for logs (no keys, no codes). */
  detail: string;
}

const ok2xx = (status: number) => status >= 200 && status < 300;

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const isExactly = (v: unknown, n: number) => v === n || v === String(n);

/** BulkSMSBD: JSON { response_code: 202, ... } means submitted. */
export function parseBulkSmsBd(status: number, raw: string): ParseResult {
  if (!ok2xx(status)) return { accepted: false, detail: `HTTP ${status}` };
  const body = parseJsonObject(raw);
  if (!body) return { accepted: false, detail: "non-JSON body" };
  const code = body.response_code;
  return isExactly(code, 202)
    ? { accepted: true, detail: "202" }
    : { accepted: false, detail: `response_code ${JSON.stringify(code ?? null).slice(0, 20)}` };
}

/** Alpha SMS: JSON { error: 0, msg: "..." } means submitted. "", null, false are NOT 0. */
export function parseAlpha(status: number, raw: string): ParseResult {
  if (!ok2xx(status)) return { accepted: false, detail: `HTTP ${status}` };
  const body = parseJsonObject(raw);
  if (!body) return { accepted: false, detail: "non-JSON body" };
  return isExactly(body.error, 0)
    ? { accepted: true, detail: "error 0" }
    : { accepted: false, detail: `error ${JSON.stringify(body.error ?? null).slice(0, 20)}` };
}

/**
 * Bulk SMS Dhaka: success is the status code 1000, either as a bare body ("1000") or as a JSON
 * field (Status / status / code / response_code exactly "1000" or 1000). Text that merely
 * CONTAINS 1000 or the word "success" ("Unsuccessful", "Balance: 1000 BDT") is a failure.
 */
export function parseBulkSmsDhaka(status: number, raw: string): ParseResult {
  if (!ok2xx(status)) return { accepted: false, detail: `HTTP ${status}` };
  const text = raw.trim();
  if (text === "1000") return { accepted: true, detail: "1000" };
  const body = parseJsonObject(text);
  if (!body) return { accepted: false, detail: text ? "unrecognised body" : "empty body" };
  for (const key of ["Status", "status", "code", "response_code"]) {
    if (key in body) {
      return isExactly(body[key], 1000)
        ? { accepted: true, detail: "1000" }
        : { accepted: false, detail: `${key} ${JSON.stringify(body[key]).slice(0, 20)}` };
    }
  }
  return { accepted: false, detail: "no status field" };
}

/**
 * The text itself (M3). The last line binds the code to our domain for WebOTP, so Android Chrome
 * can offer to fill it in, but only on our own site.
 */
export function otpMessage(opts: { appName: string; code: string; ttlMinutes: number; domain: string | null; bangla: boolean }): string {
  const body = opts.bangla
    ? `${opts.appName}: আপনার কোড ${opts.code}। ${opts.ttlMinutes} মিনিটে মেয়াদ শেষ। কাউকে জানাবেন না।`
    : `${opts.appName}: your verification code is ${opts.code}. It expires in ${opts.ttlMinutes} minutes. Do not share it.`;
  return opts.domain ? `${body}\n\n@${opts.domain} #${opts.code}` : body;
}
