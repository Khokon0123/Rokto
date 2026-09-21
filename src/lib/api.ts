export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string; // error code, see t.errors
}

/** Small JSON fetch helper that never throws: network failures become { error: "network" }. */
export async function apiCall<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "server_error" };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "network" };
  }
}
