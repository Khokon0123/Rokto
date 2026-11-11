import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

const { adminDb } = await import("@/lib/firebase/admin");
const { COL } = await import("@/lib/server/keys");
const { recordReveal } = await import("@/lib/server/reveals");
const { signInSeeker } = await import("@/lib/server/seekers");

const PHONE = "+8801712345678";
let n = 0;
const proof = () => ({ phone: PHONE, purpose: "signin" as const, jti: `jti-${++n}`, exp: Date.now() + 60_000 });
const donor = { phone: "+8801812345678", name: "Rahim Uddin", area: "kotwali", bloodGroup: "O-" };

const reveal = (seekerId: string, username: string, donorId = "d1") =>
  recordReveal({ seekerId, username, donorId, donor, ip: "1.2.3.4", subnet: "1.2.3", userAgent: "test" });

const rows = async () => (await adminDb().collection(COL.reveals).get()).docs.map((d) => d.data());

describe("reveal audit trail", () => {
  it("records who took which number, with the donor's details copied in", async () => {
    const seeker = await signInSeeker(proof());
    expect(await reveal(seeker.id, seeker.username)).toBe(true);

    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      seekerId: seeker.id,
      username: seeker.username,
      donorId: "d1",
      donorNameAtReveal: "Rahim Uddin",
      donorAreaAtReveal: "kotwali",
      donorGroupAtReveal: "O-",
      ip: "1.2.3.4",
    });
    // The phone number itself is NOT in the audit row: it is already in the donor record, and a
    // second copy with a 12-month life is a second thing to leak.
    expect(JSON.stringify(all[0])).not.toContain(donor.phone);

    const doc = await adminDb().collection(COL.seekers).doc(seeker.id).get();
    expect(doc.data()?.revealCount).toBe(1);
  });

  it("a refresh is the same look-up, not a second row", async () => {
    const seeker = await signInSeeker(proof());
    expect(await reveal(seeker.id, seeker.username)).toBe(true);
    expect(await reveal(seeker.id, seeker.username)).toBe(false);
    expect(await reveal(seeker.id, seeker.username)).toBe(false);

    expect(await rows()).toHaveLength(1);
    expect((await adminDb().collection(COL.seekers).doc(seeker.id).get()).data()?.revealCount).toBe(1);
  });

  it("looking the same donor up again later IS a new row", async () => {
    const seeker = await signInSeeker(proof());
    await reveal(seeker.id, seeker.username);

    // Age the window out. The code must not rely on Firestore's TTL sweeper having run.
    await adminDb()
      .collection(COL.revealDedup)
      .doc(`${seeker.id}:d1`)
      .set({ expireAt: Timestamp.fromMillis(Date.now() - 1000) });

    expect(await reveal(seeker.id, seeker.username)).toBe(true);
    expect(await rows()).toHaveLength(2);
  });

  it("different donors are counted separately", async () => {
    const seeker = await signInSeeker(proof());
    expect(await reveal(seeker.id, seeker.username, "d1")).toBe(true);
    expect(await reveal(seeker.id, seeker.username, "d2")).toBe(true);
    expect(await rows()).toHaveLength(2);
    expect((await adminDb().collection(COL.seekers).doc(seeker.id).get()).data()?.revealCount).toBe(2);
  });

  it("the history survives the donor deleting their profile", async () => {
    const seeker = await signInSeeker(proof());
    await reveal(seeker.id, seeker.username);
    await adminDb().collection(COL.donors).doc("d1").delete();

    const all = await rows();
    expect(all[0].donorNameAtReveal).toBe("Rahim Uddin");
  });

  it("every row carries a retention date, so nothing is kept forever", async () => {
    const seeker = await signInSeeker(proof());
    await reveal(seeker.id, seeker.username);
    const expireAt = (await rows())[0].expireAt as Timestamp;
    const days = (expireAt.toMillis() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(364);
    expect(days).toBeLessThan(366);
  });
});
