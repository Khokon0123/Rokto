export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string; // error code, see t.errors
  /** HTTP status, 0 for network failure / timeout. Lets callers tell "invalid" (404) from "down". */
  status: number;
}

/** Requests give up after this long, so a stalled network shows a retry instead of spinning (F6). */
export const API_TIMEOUT_MS = 15_000;

/** Small JSON fetch helper that never throws: network failures and timeouts become { error: "network" }. */
export async function apiCall<T>(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
  timeoutMs = API_TIMEOUT_MS,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "server_error", status: res.status };
    return { ok: true, data, status: res.status };
  } catch {
    return { ok: false, error: "network", status: 0 };
  }
}
