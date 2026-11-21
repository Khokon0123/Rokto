import { ACCOUNT_LOGIN_MAX_FAILS, ACCOUNT_LOGIN_WINDOW_SECONDS, ACCOUNT_SESSION_TTL_SECONDS } from "@/config/app";
import { ACCOUNT_COOKIE, accountCookieOptions, signAccountSession } from "@/lib/server/accountAuth";
import { accountByUsername } from "@/lib/server/accounts";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { check, clientIp, hit } from "@/lib/server/rateLimit";
import { normalizeUsername } from "@/lib/username";

// POST /api/account/login { username } -> { username }
// The search page's sign-in: a username, no phone. Only WRONG guesses are counted, so a real user
// is never throttled by their own successful sign-ins.
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const failKey = `account:login-fail:${clientIp(req)}`;
    await check(failKey, ACCOUNT_LOGIN_MAX_FAILS, ACCOUNT_LOGIN_WINDOW_SECONDS);

    const username = normalizeUsername(body.username);
    const account = username ? await accountByUsername(username) : null;
    if (!account) {
      await hit(failKey, Number.MAX_SAFE_INTEGER, ACCOUNT_LOGIN_WINDOW_SECONDS);
      throw new ApiError(404, "username_not_found");
    }
    if (account.suspended) throw new ApiError(403, "account_suspended");

    const res = json({ username: account.username });
    res.cookies.set(
      ACCOUNT_COOKIE,
      signAccountSession({ accountId: account.id, username: account.username }),
      accountCookieOptions(ACCOUNT_SESSION_TTL_SECONDS),
    );
    return res;
  });
}
