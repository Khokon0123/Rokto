import { REVEAL_MAX_PER_IP_PER_DAY, REVEAL_MAX_PER_IP_PER_HOUR } from "@/config/app";
import { verifyCaptcha } from "@/lib/server/captcha";
import { revealPhone } from "@/lib/server/donors";
import { handle, json, readJson } from "@/lib/server/http";
import { log } from "@/lib/server/log";
import { clientIp, hit } from "@/lib/server/rateLimit";
import { checkRevealPass, issueRevealPass } from "@/lib/server/revealPass";

// POST /api/donors/:id/contact { captcha? , pass? } -> { phone, pass }
// S2: numbers are revealed one at a time, on a deliberate tap, behind CAPTCHA + per-IP limits.
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const body = await readJson(req);
    const ip = clientIp(req);
    await hit(`reveal:ip:${ip}`, REVEAL_MAX_PER_IP_PER_HOUR, 3600);
    await hit(`reveal:ipday:${ip}`, REVEAL_MAX_PER_IP_PER_DAY, 86_400);
    if (!checkRevealPass(body.pass, ip)) await verifyCaptcha(body.captcha, ip, "reveal");
    const phone = await revealPhone(id);
    log("info", "phone_revealed", { donorId: id });
    return json({ phone, pass: issueRevealPass(ip) });
  });
}
