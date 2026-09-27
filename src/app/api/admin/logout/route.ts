import { ADMIN_COOKIE } from "@/lib/server/adminAuth";
import { handle, json } from "@/lib/server/http";

export function POST() {
  return handle(async () => {
    const res = json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  });
}
