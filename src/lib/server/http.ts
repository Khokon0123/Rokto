import "server-only";
import { NextResponse } from "next/server";
import { allowedOrigins, isProduction } from "./env";
import { logError } from "./log";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Default body cap for JSON routes; team photo uploads pass a larger one (S10). */
export const DEFAULT_BODY_LIMIT = 8 * 1024;

/**
 * S10: state-changing requests must come from our own pages. Browsers always send Origin on
 * cross-site POST/PATCH/DELETE, so a foreign Origin is rejected; a missing one (curl, server to
 * server) is allowed only outside production.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  const own = new URL(req.url).origin;
  const allowed = new Set([own, ...allowedOrigins()]);
  if (origin) {
    if (!allowed.has(origin)) throw new ApiError(403, "forbidden");
    return;
  }
  if (isProduction()) throw new ApiError(403, "forbidden");
}

/** Parses a JSON object body: JSON content type, size-capped, same-origin. */
export async function readJson(req: Request, maxBytes = DEFAULT_BODY_LIMIT): Promise<Record<string, unknown>> {
  assertSameOrigin(req);
  const type = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) throw new ApiError(415, "bad_request");
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new ApiError(413, "too_large");

  const text = await readCapped(req, maxBytes);
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new ApiError(400, "bad_request");
}

/** Reads the body but stops as soon as it passes the cap, whatever Content-Length claimed. */
async function readCapped(req: Request, maxBytes: number): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError(413, "too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Wraps a route body so ApiErrors become clean JSON errors and nothing leaks stack traces. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.code }, e.status);
    logError("unhandled_api_error", e);
    return json({ error: "server_error" }, 500);
  }
}
