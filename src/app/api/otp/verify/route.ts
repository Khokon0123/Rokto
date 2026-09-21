import { handle, json, readJson } from "@/lib/server/http";
import { finishOtp } from "@/lib/server/otp";

// POST /api/otp/verify { phone, code } -> { proof }. The proof is what the other endpoints accept.
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return json(await finishOtp({ phone: body.phone, code: body.code }));
  });
}
