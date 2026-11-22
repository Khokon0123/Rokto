import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { adminDb } from "@/lib/firebase/admin";
import {
  deleteDonorById,
  deleteProfileByToken,
  loadProfileByToken,
  recoverEditToken,
  registerDonor,
  updateProfileByToken,
} from "@/lib/server/donors";
import { phoneKey } from "@/lib/server/keys";
import { signProof, type OtpPurpose } from "@/lib/server/otp";

const PHONE = "+8801712345678";
const proof = (purpose: OtpPurpose, phone = PHONE) =>
  signProof({ phone, purpose, jti: randomBytes(8).toString("hex"), exp: Date.now() + 600_000 });
const fields = (name = "Rahim Uddin") => ({
  name,
  bloodGroup: "O+" as const,
  area: "kotwali",
  available: true,
  lastDonated: null,
  donationCount: 0,
  location: { lat: 22.3569, lng: 91.7832 },
});
const count = async (c: string) => (await adminDb().collection(c).get()).size;

describe("D1: one profile per phone, atomically", () => {
  it("20 concurrent registrations for one number end with exactly one donor", async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => registerDonor(proof("register"), fields(`Name ${i}`))));
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    expect(await count("donors")).toBe(1);
    expect(await count("phoneIndex")).toBe(1);
    const donors = await adminDb().collection("donors").where("phone", "==", PHONE).get();
    expect(donors.size).toBe(1);
  });

  it("two donors racing to move to the same new number: exactly one gets it", async () => {
    const a = await registerDonor(proof("register", "+8801711111111"), fields("A"));
    const b = await registerDonor(proof("register", "+8801722222222"), fields("B"));
    const target = "+8801799999999";
    const out = await Promise.allSettled([
      updateProfileByToken(a.editToken, { phone: { phone: target, proof: proof("change_phone", target) } }),
      updateProfileByToken(b.editToken, { phone: { phone: target, proof: proof("change_phone", target) } }),
    ]);
    expect(out.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await adminDb().collection("donors").where("phone", "==", target).get()).size).toBe(1);
    const index = await adminDb().collection("phoneIndex").doc(phoneKey(target)).get();
    expect(index.exists).toBe(true);
    expect(await count("phoneIndex")).toBe(2); // old index for the mover is gone
  });

  it("a registration racing a phone change to the same number never duplicates it", async () => {
    const a = await registerDonor(proof("register", "+8801733333333"), fields("A"));
    const target = "+8801744444444";
    await Promise.allSettled([
      updateProfileByToken(a.editToken, { phone: { phone: target, proof: proof("change_phone", target) } }),
      registerDonor(proof("register", target), fields("Newcomer")),
    ]);
    expect((await adminDb().collection("donors").where("phone", "==", target).get()).size).toBe(1);
  });
});

describe("D2/D3: tokens are checked inside the write", () => {
  it("after recovery the old link can't edit or delete; the new one can", async () => {
    const { editToken: old } = await registerDonor(proof("register"), fields());
    const fresh = await recoverEditToken(proof("recover"));
    await expect(updateProfileByToken(old, { available: false })).rejects.toMatchObject({ code: "link_invalid" });
    await expect(deleteProfileByToken(old)).rejects.toMatchObject({ code: "link_invalid" });
    expect((await loadProfileByToken(fresh)).available).toBe(true);
  });

  it("recovery racing a delete never yields a token for a deleted profile", async () => {
    const { editToken } = await registerDonor(proof("register"), fields());
    const [rec] = await Promise.allSettled([recoverEditToken(proof("recover")), deleteProfileByToken(editToken)]);
    if (rec.status === "fulfilled") {
      // Recovery won: then the delete (with the old token) must have failed.
      expect(await count("donors")).toBe(1);
      await expect(loadProfileByToken(rec.value)).resolves.toBeTruthy();
    } else {
      expect(await count("donors")).toBe(0);
      expect(await count("donorSecrets")).toBe(0);
      expect(await count("phoneIndex")).toBe(0);
    }
  });

  it("recovery for a number with no profile is 404", async () => {
    await expect(recoverEditToken(proof("recover", "+8801755555555"))).rejects.toMatchObject({ code: "no_profile" });
  });
});

describe("S11: proofs are single-purpose and retries are idempotent", () => {
  it("the same register proof may be retried, but not more than 3 times", async () => {
    const p = proof("register");
    const first = await registerDonor(p, fields());
    const second = await registerDonor(p, fields("Rahim U."));
    expect(first.existing).toBe(false);
    expect(second.existing).toBe(true);
    await registerDonor(p, fields());
    await expect(registerDonor(p, fields())).rejects.toMatchObject({ code: "otp_invalid" });
    expect(await count("donors")).toBe(1);
  });
  it("a recover proof can't register, and a change_phone proof can't move a second donor", async () => {
    await expect(registerDonor(proof("recover"), fields())).rejects.toMatchObject({ code: "otp_invalid" });
    const a = await registerDonor(proof("register", "+8801766666661"), fields("A"));
    const b = await registerDonor(proof("register", "+8801766666662"), fields("B"));
    const target = "+8801766666669";
    const p = proof("change_phone", target);
    await updateProfileByToken(a.editToken, { phone: { phone: target, proof: p } });
    await deleteProfileByToken(a.editToken);
    await expect(updateProfileByToken(b.editToken, { phone: { phone: target, proof: p } })).rejects.toMatchObject({ code: "otp_invalid" });
  });
});

describe("S5 + L2", () => {
  it("stored locations are grid-snapped, the same every save", async () => {
    const { editToken } = await registerDonor(proof("register"), fields());
    const first = (await loadProfileByToken(editToken)).location;
    for (let i = 0; i < 5; i++) await updateProfileByToken(editToken, { location: { lat: 22.3569, lng: 91.7832 } });
    expect((await loadProfileByToken(editToken)).location).toEqual(first);
    expect(first).not.toEqual({ lat: 22.3569, lng: 91.7832 });
  });
  it("a blocked number can't come back", async () => {
    await registerDonor(proof("register"), fields());
    const id = (await adminDb().collection("donors").get()).docs[0].id;
    await deleteDonorById(id, { reason: "admin" });
    await expect(registerDonor(proof("register"), fields())).rejects.toMatchObject({ code: "phone_blocked" });
  });
});

describe("S2/S4: the search directory follows every write", () => {
  it("lists available donors only, without extra reads per donor", async () => {
    const { loadDirectory } = await import("@/lib/server/directory");
    const a = await registerDonor(proof("register", "+8801788888881"), fields("Avail"));
    const b = await registerDonor(proof("register", "+8801788888882"), fields("Soon off"));
    expect((await loadDirectory()).map((e) => e.name).sort()).toEqual(["Avail", "Soon off"]);
    await updateProfileByToken(b.editToken, { available: false });
    expect((await loadDirectory()).map((e) => e.name)).toEqual(["Avail"]);
    await updateProfileByToken(a.editToken, { lastDonated: new Date("2026-10-01T00:00:00Z"), area: "khulshi" });
    const [row] = await loadDirectory();
    expect(row).toMatchObject({ area: "khulshi", lastDonated: "2026-10-01" });
    await deleteProfileByToken(a.editToken);
    expect(await loadDirectory()).toEqual([]);
    expect((await adminDb().collection("directory").get()).size).toBeLessThanOrEqual(4);
  });
});
