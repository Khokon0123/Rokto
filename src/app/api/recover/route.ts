import { handle, json, readJson } from "@/lib/server/http";
import { recoverEditToken } from "@/lib/server/donors";

// POST /api/recover { proof } - lost edit link. Needs a "recover" proof. Issues a NEW link (the old
// one dies). Links can't be "retrieved" because only a hash of each token is stored.
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return json({ editToken: await recoverEditToken(body.proof) });
  });
}
