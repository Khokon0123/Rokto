import { isValidAreaId } from "@/lib/areas";
import { isBloodGroup } from "@/lib/bloodGroups";
import { isValidGeoPoint, type GeoPoint } from "@/lib/geo";
import { cleanName, parseDateOnly } from "@/lib/validation";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { verifyPhoneProof } from "@/lib/server/otp";
import { upsertDonorByPhone } from "@/lib/server/donors";

// POST /api/donors - register (or, if this phone already has a profile, refresh it).
// Requires a fresh phone-verification proof (from /api/otp/verify); the phone comes from the proof.
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);

    const name = cleanName(body.name);
    if (!name) throw new ApiError(400, "name_invalid");
    if (!isBloodGroup(body.bloodGroup)) throw new ApiError(400, "blood_group_invalid");
    if (!isValidAreaId(body.area)) throw new ApiError(400, "area_invalid");
    if (typeof body.available !== "boolean") throw new ApiError(400, "bad_request");
    if (body.consent !== true) throw new ApiError(400, "consent_required");

    let lastDonated: Date | null = null;
    if (body.lastDonated !== null && body.lastDonated !== undefined && body.lastDonated !== "") {
      lastDonated = parseDateOnly(body.lastDonated);
      if (!lastDonated) throw new ApiError(400, "date_invalid");
    }

    let location: GeoPoint | null = null;
    if (body.location !== null && body.location !== undefined) {
      if (!isValidGeoPoint(body.location)) throw new ApiError(400, "location_invalid");
      location = body.location;
    }

    const { phone } = verifyPhoneProof(body.proof);
    const result = await upsertDonorByPhone(phone, {
      name,
      bloodGroup: body.bloodGroup,
      area: body.area,
      available: body.available,
      lastDonated,
      location,
    });
    return json(result);
  });
}
