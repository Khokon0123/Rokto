import { handle, json, readJson } from "@/lib/server/http";
import { SEEKER_COOKIE, seekerCookieOptions } from "@/lib/server/seekerAuth";

// POST /api/seeker/logout - drops the cookie. The account and its history stay; signing in again
// with the same number returns the same username.
export function POST(req: Request) {
  return handle(async () => {
    await readJson(req); // same-origin check
    const res = json({ ok: true });
    res.cookies.set(SEEKER_COOKIE, "", seekerCookieOptions(0));
    return res;
  });
}
