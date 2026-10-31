import { handle, json, readJson } from "@/lib/server/http";
import { finishOtp } from "@/lib/server/otp";

// POST /api/otp/verify { phone, code, challengeId, purpose } -> { proof }
// The proof is accepted by exactly one endpoint: the one named by `purpose`.
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return json(
      await finishOtp({ phone: body.phone, code: body.code, challengeId: body.challengeId, purpose: body.purpose }),
    );
  });
}
