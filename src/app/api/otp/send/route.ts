import { clientIp } from "@/lib/server/rateLimit";
import { handle, json, readJson } from "@/lib/server/http";
import { startOtp } from "@/lib/server/otp";

// POST /api/otp/send { phone, captcha? } - texts a 6-digit code to a Bangladesh mobile number.
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    await startOtp({ phone: body.phone, captcha: body.captcha, ip: clientIp(req) });
    return json({ ok: true });
  });
}
