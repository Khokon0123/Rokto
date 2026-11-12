import { handle, json, readJson } from "@/lib/server/http";
import { deleteProfileByToken, loadProfileByToken, updateProfileByToken } from "@/lib/server/donors";
import { parsePatch } from "@/lib/server/profilePatch";

// The edit token in the request body is the sole credential for every method here. It is checked
// inside the same transaction as the change it authorizes (D3).

// POST /api/edit  { token } -> load profile
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return json({ profile: await loadProfileByToken(body.token) });
  });
}

// PATCH /api/edit  { token, available?, lastDonated?, area?, location?, name?, bloodGroup?, phone? + proof }
export function PATCH(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return json({ profile: await updateProfileByToken(body.token, parsePatch(body)) });
  });
}

// DELETE /api/edit  { token } -> remove profile, its token record and its phone index
export function DELETE(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    await deleteProfileByToken(body.token);
    return json({ ok: true });
  });
}
