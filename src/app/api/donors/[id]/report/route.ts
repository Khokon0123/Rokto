import { REPORT_MAX_PER_IP_PER_DAY } from "@/config/app";
import { verifyCaptcha } from "@/lib/server/captcha";
import { handle, json, readJson } from "@/lib/server/http";
import { sha256 } from "@/lib/server/keys";
import { alert } from "@/lib/server/log";
import { clientIp, hit } from "@/lib/server/rateLimit";
import { cleanNote, createReport, parseReason } from "@/lib/server/reports";

// POST /api/donors/:id/report { reason, note?, captcha } - "Report this listing" (L2).
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const body = await readJson(req);
    const ip = clientIp(req);
    const reason = parseReason(body.reason);
    const note = cleanNote(body.note);
    await verifyCaptcha(body.captcha, ip, "report");
    await hit(`report:ip:${ip}`, REPORT_MAX_PER_IP_PER_DAY, 86_400);
    await createReport(id, reason, note, sha256(ip).slice(0, 16));
    if (reason === "harassment") await alert("A listing was reported for harassment. Check the admin panel.");
    return json({ ok: true });
  });
}
