import { ACCOUNT_SESSION_TTL_SECONDS } from "@/config/app";
import { handle, json, readJson } from "@/lib/server/http";
import { log } from "@/lib/server/log";
import { verifyPhoneProof } from "@/lib/server/otp";
import { clientIp, hit } from "@/lib/server/rateLimit";
import { ACCOUNT_COOKIE, accountCookieOptions, signAccountSession } from "@/lib/server/accountAuth";
import { signInAccount } from "@/lib/server/accounts";

// POST /api/account/signin { proof } -> { username, created }
// The phone is never read from the request: it comes out of the signed OTP proof (S11).
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    await hit(`account:signup:${clientIp(req)}`, 10, 3600);
    const proof = verifyPhoneProof(body.proof, "signin");
    const account = await signInAccount(proof);

    log("info", account.created ? "account_created" : "account_signed_in", { username: account.username });
    const res = json({ username: account.username, created: account.created });
    res.cookies.set(
      ACCOUNT_COOKIE,
      signAccountSession({ accountId: account.id, username: account.username }),
      accountCookieOptions(ACCOUNT_SESSION_TTL_SECONDS),
    );
    return res;
  });
}
