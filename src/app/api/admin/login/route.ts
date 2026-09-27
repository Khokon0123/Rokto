import { ADMIN_LOGIN_MAX_ATTEMPTS, ADMIN_LOGIN_WINDOW_SECONDS, ADMIN_SESSION_TTL_SECONDS } from "@/config/app";
import { ADMIN_COOKIE, checkAdminPassword, signAdminSession } from "@/lib/server/adminAuth";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { clientIp, hit } from "@/lib/server/rateLimit";

// POST /api/admin/login - the only door in. Rate limited per IP since this guards everything else.
export function POST(req: Request) {
  return handle(async () => {
    await hit(`admin:login:${clientIp(req)}`, ADMIN_LOGIN_MAX_ATTEMPTS, ADMIN_LOGIN_WINDOW_SECONDS);
    const body = await readJson(req);
    if (!checkAdminPassword(body.password)) throw new ApiError(401, "admin_password_wrong");

    const res = json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, signAdminSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });
    return res;
  });
}
