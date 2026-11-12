import { handle, json, readJson } from "@/lib/server/http";
import { ACCOUNT_COOKIE, accountCookieOptions } from "@/lib/server/accountAuth";

// POST /api/account/logout - drops the cookie. The account and its history stay; signing in again
// with the same number returns the same username.
export function POST(req: Request) {
  return handle(async () => {
    await readJson(req); // same-origin check
    const res = json({ ok: true });
    res.cookies.set(ACCOUNT_COOKIE, "", accountCookieOptions(0));
    return res;
  });
}
