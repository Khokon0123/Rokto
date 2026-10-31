import { ALLOW_PROFILE_CORRECTIONS } from "@/config/app";
import { isValidAreaId } from "@/lib/areas";
import { isBloodGroup } from "@/lib/bloodGroups";
import { isValidGeoPoint } from "@/lib/geo";
import { normalizeBdPhone } from "@/lib/phone";
import { cleanName, parseDateOnly } from "@/lib/validation";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { deleteProfileByToken, loadProfileByToken, updateProfileByToken, type ProfilePatch } from "@/lib/server/donors";

// The edit token in the request body is the sole credential for every method here. It is checked
// inside the same transaction as the change it authorizes (D3).

// POST /api/edit  { token } -> load profile
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return json({ profile: await loadProfileByToken(body.token) });
  });
}

function parsePatch(body: Record<string, unknown>): ProfilePatch {
  const patch: ProfilePatch = {};
  if ("available" in body) {
    if (typeof body.available !== "boolean") throw new ApiError(400, "bad_request");
    patch.available = body.available;
  }
  if ("lastDonated" in body) {
    if (body.lastDonated === null || body.lastDonated === "") patch.lastDonated = null;
    else {
      const d = parseDateOnly(body.lastDonated);
      if (!d) throw new ApiError(400, "date_invalid");
      patch.lastDonated = d;
    }
  }
  if ("area" in body) {
    if (!isValidAreaId(body.area)) throw new ApiError(400, "area_invalid");
    patch.area = body.area;
  }
  if ("location" in body) {
    if (body.location !== null && !isValidGeoPoint(body.location)) throw new ApiError(400, "location_invalid");
    patch.location = body.location as ProfilePatch["location"];
  }
  if ("name" in body || "bloodGroup" in body) {
    if (!ALLOW_PROFILE_CORRECTIONS) throw new ApiError(400, "bad_request");
    if ("name" in body) {
      const name = cleanName(body.name);
      if (!name) throw new ApiError(400, "name_invalid");
      patch.name = name;
    }
    if ("bloodGroup" in body) {
      if (!isBloodGroup(body.bloodGroup)) throw new ApiError(400, "blood_group_invalid");
      patch.bloodGroup = body.bloodGroup;
    }
  }
  if ("phone" in body) {
    const phone = typeof body.phone === "string" ? normalizeBdPhone(body.phone) : null;
    if (!phone) throw new ApiError(400, "phone_invalid");
    patch.phone = { phone, proof: body.proof };
  }
  return patch;
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
