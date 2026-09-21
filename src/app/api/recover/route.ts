import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { verifyPhoneProof } from "@/lib/server/otp";
import { rotateTokenByPhone } from "@/lib/server/donors";

// POST /api/recover - lost edit link. After a fresh SMS code, issue a NEW link (the old one dies).
// Links can't be "retrieved" because only a hash of each token is stored.
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const { phone } = verifyPhoneProof(body.proof);
    const editToken = await rotateTokenByPhone(phone);
    if (!editToken) throw new ApiError(404, "no_profile");
    return json({ editToken });
  });
}
