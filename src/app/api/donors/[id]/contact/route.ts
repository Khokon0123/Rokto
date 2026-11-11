import {
  REVEAL_MAX_PER_IP_PER_DAY,
  REVEAL_MAX_PER_IP_PER_HOUR,
  REVEAL_MAX_PER_SEEKER_PER_DAY,
  REVEAL_MAX_PER_SEEKER_PER_HOUR,
} from "@/config/app";
import { verifyCaptcha } from "@/lib/server/captcha";
import { revealPhone } from "@/lib/server/donors";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { alert, log } from "@/lib/server/log";
import { clientIp, hit, subnetOf } from "@/lib/server/rateLimit";
import { checkRevealPass, issueRevealPass } from "@/lib/server/revealPass";
import { recordReveal } from "@/lib/server/reveals";
import { currentSeeker } from "@/lib/server/seekerAuth";
import { loadSeeker } from "@/lib/server/seekers";

// POST /api/donors/:id/contact { captcha? , pass? } -> { phone, pass }
// S2: numbers are revealed one at a time, on a deliberate tap, behind CAPTCHA + per-IP limits.
// Signed in, the reveal is also recorded against the account (phase 2). Signing in is not required
// yet, so an anonymous reveal still works - and leaves no trail, which is what phase 3 fixes.
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const body = await readJson(req);
    const ip = clientIp(req);
    await hit(`reveal:ip:${ip}`, REVEAL_MAX_PER_IP_PER_HOUR, 3600);
    await hit(`reveal:ipday:${ip}`, REVEAL_MAX_PER_IP_PER_DAY, 86_400);

    // The account is read live, not trusted from the cookie: a suspension has to bite at once,
    // and the cookie is valid for 30 days.
    const session = currentSeeker(req);
    const seeker = session ? await loadSeeker(session.seekerId) : null;
    if (seeker?.suspended) throw new ApiError(403, "seeker_suspended");
    if (seeker) {
      await hit(`reveal:seeker:${seeker.id}`, REVEAL_MAX_PER_SEEKER_PER_HOUR, 3600);
      await hit(`reveal:seekerday:${seeker.id}`, REVEAL_MAX_PER_SEEKER_PER_DAY, 86_400);
    }

    if (!checkRevealPass(body.pass, ip)) await verifyCaptcha(body.captcha, ip, "reveal");
    const donor = await revealPhone(id);

    if (seeker) {
      // Blood first: if the audit write fails we shout about it, but we do not deny someone a
      // number in an emergency over a logging error. The rate limits above have already applied.
      try {
        const written = await recordReveal({
          seekerId: seeker.id,
          username: seeker.username,
          donorId: id,
          donor,
          ip,
          subnet: subnetOf(ip),
          userAgent: req.headers.get("user-agent") ?? "",
        });
        log("info", "phone_revealed", { donorId: id, username: seeker.username, logged: written });
      } catch {
        await alert(`A reveal by ${seeker.username} could not be recorded (donor ${id}).`);
        log("info", "phone_revealed", { donorId: id, username: seeker.username, logged: false });
      }
    } else {
      log("info", "phone_revealed", { donorId: id });
    }

    return json({ phone: donor.phone, pass: issueRevealPass(ip) });
  });
}
