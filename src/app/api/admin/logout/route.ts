import { ADMIN_COOKIE, adminCookieOptions } from "@/lib/server/adminAuth";
import { handle, json, readJson } from "@/lib/server/http";

// POST /api/admin/logout - clears the cookie with the SAME attributes it was set with (S7).
// To log out every session everywhere, change ADMIN_PASSWORD or bump ADMIN_SESSION_VERSION.
export function POST(req: Request) {
  return handle(async () => {
    await readJson(req);
    const res = json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, "", adminCookieOptions(0));
    return res;
  });
}
