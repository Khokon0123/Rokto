import { FieldValue } from "firebase-admin/firestore";
import { isValidAreaId } from "@/lib/areas";
import { fuzzGeoPoint, isValidGeoPoint } from "@/lib/geo";
import { normalizeBdPhone } from "@/lib/phone";
import { parseDateOnly } from "@/lib/validation";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { verifyPhoneProof } from "@/lib/server/otp";
import {
  deleteDonor,
  findDonorRefByToken,
  phoneTakenByOther,
  toEditable,
  toTimestamp,
} from "@/lib/server/donors";

// The edit token in the request body is the sole credential for every method here.

async function requireDonor(token: unknown) {
  const ref = await findDonorRefByToken(token);
  if (!ref) throw new ApiError(404, "link_invalid");
  const snap = await ref.get();
  if (!snap.exists) throw new ApiError(404, "link_invalid");
  return { ref, data: snap.data()! };
}

// POST /api/edit  { token } -> load profile
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const { data } = await requireDonor(body.token);
    return json({ profile: toEditable(data) });
  });
}

// PATCH /api/edit  { token, available?, lastDonated?, area?, phone?, proof? }
export function PATCH(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const { ref, data } = await requireDonor(body.token);
    const updates: Record<string, unknown> = {};

    if ("available" in body) {
      if (typeof body.available !== "boolean") throw new ApiError(400, "bad_request");
      updates.available = body.available;
    }
    if ("lastDonated" in body) {
      if (body.lastDonated === null || body.lastDonated === "") {
        updates.lastDonated = null;
      } else {
        const d = parseDateOnly(body.lastDonated);
        if (!d) throw new ApiError(400, "date_invalid");
        updates.lastDonated = toTimestamp(d);
      }
    }
    if ("area" in body) {
      if (!isValidAreaId(body.area)) throw new ApiError(400, "area_invalid");
      updates.area = body.area;
    }
    if ("location" in body) {
      if (body.location === null) {
        updates.location = null;
      } else {
        if (!isValidGeoPoint(body.location)) throw new ApiError(400, "location_invalid");
        // Re-fuzzed on every save, including an update to an already-fuzzed point - the donor's
        // device only ever reports its own real position, so this is where privacy is enforced.
        updates.location = fuzzGeoPoint(body.location);
      }
    }

    if ("phone" in body) {
      const newPhone = typeof body.phone === "string" ? normalizeBdPhone(body.phone) : null;
      if (!newPhone) throw new ApiError(400, "phone_invalid");
      if (newPhone !== data.phone) {
        // A new number must be proven with a fresh OTP for THAT number.
        const verified = verifyPhoneProof(body.proof);
        if (verified.phone !== newPhone) throw new ApiError(401, "otp_invalid");
        if (await phoneTakenByOther(newPhone, ref.id)) throw new ApiError(409, "phone_taken");
        updates.phone = newPhone;
        updates.phoneVerified = true;
      }
    }

    if (Object.keys(updates).length === 0) throw new ApiError(400, "bad_request");
    updates.updatedAt = FieldValue.serverTimestamp();
    await ref.update(updates);

    const fresh = await ref.get();
    return json({ profile: toEditable(fresh.data()!) });
  });
}

// DELETE /api/edit  { token } -> remove profile and its token record
export function DELETE(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const { ref } = await requireDonor(body.token);
    await deleteDonor(ref.id);
    return json({ ok: true });
  });
}
