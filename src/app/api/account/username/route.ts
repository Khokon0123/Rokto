import { ACCOUNT_RENAMES_PER_DAY, ACCOUNT_SESSION_TTL_SECONDS } from "@/config/app";
import { ACCOUNT_COOKIE, accountCookieOptions, requireAccount, signAccountSession } from "@/lib/server/accountAuth";
import { loadAccount, renameAccount } from "@/lib/server/accounts";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { hit } from "@/lib/server/rateLimit";
import { normalizeUsername } from "@/lib/username";

// PATCH /api/account/username { username } -> { username }
// A taken name is 409 username_taken and nothing changes. The cookie carries the name as a label,
// so it is re-signed here.
export function PATCH(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const session = requireAccount(req);
    const username = normalizeUsername(body.username);
    if (!username) throw new ApiError(400, "username_invalid");

    const account = await loadAccount(session.accountId);
    if (!account) throw new ApiError(401, "account_required");
    if (account.suspended) throw new ApiError(403, "account_suspended");

    await hit(`account:rename:${account.id}`, ACCOUNT_RENAMES_PER_DAY, 86_400);
    await renameAccount(account.id, username);

    const res = json({ username });
    res.cookies.set(
      ACCOUNT_COOKIE,
      signAccountSession({ accountId: account.id, username }),
      accountCookieOptions(ACCOUNT_SESSION_TTL_SECONDS),
    );
    return res;
  });
}
