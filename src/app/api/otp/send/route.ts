import { clientIp } from "@/lib/server/rateLimit";
import { handle, json, readJson } from "@/lib/server/http";
import { startOtp } from "@/lib/server/otp";

// POST /api/otp/send { phone, purpose, captcha, locale? } -> { challengeId }
// Texts a 6-digit code to a Bangladesh mobile number. `purpose` is register | recover | change_phone.
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const out = await startOtp({
      phone: body.phone,
      purpose: body.purpose,
      captcha: body.captcha,
      ip: clientIp(req),
      locale: body.locale === "bn" ? "bn" : "en",
    });
    return json(out);
  });
}
