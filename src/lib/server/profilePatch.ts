import "server-only";
import { ALLOW_PROFILE_CORRECTIONS } from "@/config/app";
import { isValidAreaId } from "@/lib/areas";
import { isAvatarId } from "@/lib/avatars";
import { isBloodGroup } from "@/lib/bloodGroups";
import { isValidGeoPoint } from "@/lib/geo";
import { normalizeBdPhone } from "@/lib/phone";
import { cleanName, parseDateOnly, parseDonationCount } from "@/lib/validation";
import type { ProfilePatch } from "./donors";
import { ApiError } from "./http";

// One validator for both doors into a profile: the private edit link (/api/edit) and a signed-in
// account (/api/account/listing). Two copies would drift, and the quieter copy would be the weaker.
export function parsePatch(body: Record<string, unknown>): ProfilePatch {
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
  if ("donationCount" in body) {
    const count = parseDonationCount(body.donationCount);
    if (count === undefined) throw new ApiError(400, "count_invalid");
    patch.donationCount = count;
  }
  if ("avatar" in body) {
    if (body.avatar !== null && !isAvatarId(body.avatar)) throw new ApiError(400, "bad_request");
    patch.avatar = body.avatar as string | null;
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
