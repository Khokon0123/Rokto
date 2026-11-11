import { SEEKER_SESSION_TTL_SECONDS } from "@/config/app";
import { handle, json, readJson } from "@/lib/server/http";
import { log } from "@/lib/server/log";
import { verifyPhoneProof } from "@/lib/server/otp";
import { clientIp, hit } from "@/lib/server/rateLimit";
import { SEEKER_COOKIE, seekerCookieOptions, signSeekerSession } from "@/lib/server/seekerAuth";
import { signInSeeker } from "@/lib/server/seekers";

// POST /api/seeker/signup { proof } -> { username, created }
// The phone is never read from the request: it comes out of the signed OTP proof (S11).
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    await hit(`seeker:signup:${clientIp(req)}`, 10, 3600);
    const proof = verifyPhoneProof(body.proof, "signin");
    const seeker = await signInSeeker(proof);

    log("info", seeker.created ? "seeker_created" : "seeker_signed_in", { username: seeker.username });
    const res = json({ username: seeker.username, created: seeker.created });
    res.cookies.set(
      SEEKER_COOKIE,
      signSeekerSession({ seekerId: seeker.id, username: seeker.username }),
      seekerCookieOptions(SEEKER_SESSION_TTL_SECONDS),
    );
    return res;
  });
}
