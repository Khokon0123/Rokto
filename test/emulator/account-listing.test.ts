import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { adminDb } from "@/lib/firebase/admin";
import { byPhone, byToken, deleteProfile, loadProfile, registerDonor, updateProfile } from "@/lib/server/donors";
import { COL } from "@/lib/server/keys";
import { signProof, type OtpPurpose } from "@/lib/server/otp";

// The second door into a profile: a signed-in account, authorised by the number it verified,
// instead of the private edit link. Same operations, same rules - only the credential differs.

const PHONE = "+8801712345678";
const proof = (purpose: OtpPurpose, phone = PHONE) =>
  signProof({ phone, purpose, jti: randomBytes(8).toString("hex"), exp: Date.now() + 600_000 });
const fields = {
  name: "Rahim Uddin",
  bloodGroup: "O+" as const,
  area: "kotwali",
  available: true,
  lastDonated: null,
  donationCount: 0,
  location: { lat: 22.3569, lng: 91.7832 },
};

describe("the account door into a donor listing", () => {
  it("finds the listing by the account's own number", async () => {
    await registerDonor(proof("register"), fields);
    expect(await loadProfile(byPhone(PHONE))).toMatchObject({ name: "Rahim Uddin", bloodGroup: "O+", area: "kotwali" });
  });

  it("edits name, blood group and donation date the same way the link does", async () => {
    await registerDonor(proof("register"), fields);
    const updated = await updateProfile(byPhone(PHONE), {
      name: "Rahim Uddin Chowdhury",
      bloodGroup: "O-",
      lastDonated: new Date("2026-09-01"),
      available: false,
    });
    expect(updated).toMatchObject({ name: "Rahim Uddin Chowdhury", bloodGroup: "O-", available: false });
    expect(updated.lastDonated).toBe("2026-09-01");

    // An unavailable donor leaves the search directory, exactly as through the link.
    const shards = await adminDb().collection(COL.directory).get();
    const entries = shards.docs.flatMap((d) => Object.values((d.data().entries ?? {}) as Record<string, unknown>));
    expect(entries).toHaveLength(0);
  });

  it("a number with no listing is 'no_profile', not a broken link", async () => {
    await expect(loadProfile(byPhone("+8801999999999"))).rejects.toMatchObject({ code: "no_profile" });
  });

  it("cannot reach anyone else's listing", async () => {
    await registerDonor(proof("register"), fields);
    await expect(updateProfile(byPhone("+8801812345678"), { name: "Someone Else" })).rejects.toMatchObject({
      code: "no_profile",
    });
    expect(await loadProfile(byPhone(PHONE))).toMatchObject({ name: "Rahim Uddin" });
  });

  it("the two doors act on one and the same listing", async () => {
    const { editToken } = await registerDonor(proof("register"), fields);
    await updateProfile(byPhone(PHONE), { name: "Changed By Account" });
    expect(await loadProfile(byToken(editToken))).toMatchObject({ name: "Changed By Account" });

    await deleteProfile(byPhone(PHONE));
    await expect(loadProfile(byToken(editToken))).rejects.toMatchObject({ code: "link_invalid" });
  });
});
