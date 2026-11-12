import { loadAccountDetail } from "@/lib/server/accounts";
import { byPhone, deleteProfile, updateProfile } from "@/lib/server/donors";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { loadProfile } from "@/lib/server/donors";
import { parsePatch } from "@/lib/server/profilePatch";
import { requireAccount } from "@/lib/server/accountAuth";

// The signed-in person's own donor listing. The private edit link still works and is unchanged;
// this is the second door, for people who have an account and would rather not keep a link safe.
//
// The number is never taken from the request: it comes off the account, which got it from a code
// texted to that number. The listing is then found through phoneIndex, so the account and the
// listing can never disagree about who owns what.
async function ownerFor(req: Request) {
  const session = requireAccount(req);
  const account = await loadAccountDetail(session.accountId);
  if (!account) throw new ApiError(401, "account_required");
  if (account.suspended) throw new ApiError(403, "account_suspended");
  return byPhone(account.phone);
}

// GET /api/account/listing -> the signed-in person's own listing, or 404 no_profile.
export function GET(req: Request) {
  return handle(async () => json({ profile: await loadProfile(await ownerFor(req)) }));
}

// PATCH /api/account/listing { available?, lastDonated?, area?, location?, name?, bloodGroup? }
export function PATCH(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const owner = await ownerFor(req);
    const patch = parsePatch(body);
    // Changing the number moves the account as well as the listing, so it is its own flow and
    // not something this endpoint half-does.
    if (patch.phone) throw new ApiError(400, "bad_request");
    return json({ profile: await updateProfile(owner, patch) });
  });
}

// DELETE /api/account/listing -> remove the donor listing. The account itself stays.
export function DELETE(req: Request) {
  return handle(async () => {
    await readJson(req); // same-origin check
    await deleteProfile(await ownerFor(req));
    return json({ ok: true });
  });
}
