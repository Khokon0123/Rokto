import { ACCOUNT_SESSION_TTL_SECONDS } from "@/config/app";
import { ACCOUNT_COOKIE, accountCookieOptions, signAccountSession } from "@/lib/server/accountAuth";
import { ensureAccount } from "@/lib/server/accounts";
import { handle, json, readJson } from "@/lib/server/http";
import { log } from "@/lib/server/log";
import { finishOtp } from "@/lib/server/otp";

// POST /api/otp/verify { phone, code, challengeId, purpose } -> { proof, username? }
// The proof is accepted by exactly one endpoint: the one named by `purpose`.
//
// Checking a code texted to a number IS the act of proving you own it, so this is also where an
// account begins. One code, one account - there is no separate "sign up" step to forget, and
// registering as a donor signs you in at the same time.
//
// Not for every purpose: "recover" and "change_phone" are errands run by someone who is already
// known, and neither should quietly mint a session.
const SIGNS_IN = new Set(["register", "signin"]);

export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const { proof, phone, purpose } = await finishOtp({
      phone: body.phone,
      code: body.code,
      challengeId: body.challengeId,
      purpose: body.purpose,
    });
    if (!SIGNS_IN.has(purpose)) return json({ proof });

    const account = await ensureAccount(phone);
    log("info", account.created ? "account_created" : "account_signed_in", { username: account.username });
    const res = json({ proof, username: account.username, created: account.created });
    res.cookies.set(
      ACCOUNT_COOKIE,
      signAccountSession({ accountId: account.id, username: account.username }),
      accountCookieOptions(ACCOUNT_SESSION_TTL_SECONDS),
    );
    return res;
  });
}
