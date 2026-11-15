import { ADMIN_LOGIN_MAX_ATTEMPTS, ADMIN_LOGIN_WINDOW_SECONDS, ADMIN_SESSION_TTL_SECONDS } from "@/config/app";
import { ADMIN_COOKIE, adminCookieOptions, checkAdminPassword, signAdminSession } from "@/lib/server/adminAuth";
import { verifyAdminUser } from "@/lib/server/adminUsers";
import { writeAudit } from "@/lib/server/adminDonors";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { clientIp, hit } from "@/lib/server/rateLimit";

// POST /api/admin/login - the only door in. Rate limited per IP since this guards everything else.
//
// Two ways through it:
//   - an email + that person's own password (adminUsers), which is what the audit trail records;
//   - no email, and the shared ADMIN_PASSWORD, kept as a way back in if a password is lost or
//     Firestore is unreachable. It is deliberately the second-class route, not the normal one.
export function POST(req: Request) {
  return handle(async () => {
    await hit(`admin:login:${clientIp(req)}`, ADMIN_LOGIN_MAX_ATTEMPTS, ADMIN_LOGIN_WINDOW_SECONDS);
    const body = await readJson(req);

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const who = email
      ? await verifyAdminUser(email, body.password)
      : checkAdminPassword(body.password)
        ? { email: null }
        : null;
    if (!who) throw new ApiError(401, "admin_password_wrong");

    const res = json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, signAdminSession({ email: who.email }), adminCookieOptions(ADMIN_SESSION_TTL_SECONDS));
    // The cookie is on the response, not the request, so the audit row is written by hand here.
    await writeAudit("admin_login", who.email ?? "recovery-password", req, { by: who.email ?? "recovery-password" });
    return res;
  });
}
