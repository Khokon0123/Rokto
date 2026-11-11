import { describe, expect, it } from "vitest";

const { adminDb } = await import("@/lib/firebase/admin");
const { signInSeeker, loadSeeker } = await import("@/lib/server/seekers");
const { COL, phoneKey } = await import("@/lib/server/keys");

const PHONE = "+8801712345678";
let n = 0;
/** A verified-phone proof, as /api/seeker/signup hands it over after verifyPhoneProof(). */
const proof = (phone = PHONE, jti = `jti-${++n}`) => ({ phone, purpose: "signin" as const, jti, exp: Date.now() + 60_000 });

describe("seeker accounts", () => {
  it("one account per number: the second sign-in returns the SAME username", async () => {
    const first = await signInSeeker(proof());
    expect(first.created).toBe(true);
    expect(first.id).toBe(phoneKey(PHONE));

    const second = await signInSeeker(proof());
    expect(second.created).toBe(false);
    expect(second.username).toBe(first.username);

    // Clearing cookies must not buy a fresh identity - that is the point of the audit trail.
    const all = await adminDb().collection(COL.seekers).get();
    expect(all.size).toBe(1);
  });

  it("claims the username so no one else can hold it", async () => {
    const { username } = await signInSeeker(proof());
    const claim = await adminDb().collection(COL.seekerUsernames).doc(username).get();
    expect(claim.exists).toBe(true);
    expect(claim.data()?.seekerId).toBe(phoneKey(PHONE));
  });

  it("two simultaneous sign-ins for one number create one account, not two", async () => {
    const out = await Promise.allSettled([signInSeeker(proof()), signInSeeker(proof())]);
    expect(out.filter((r) => r.status === "fulfilled").length).toBeGreaterThan(0);

    const all = await adminDb().collection(COL.seekers).get();
    expect(all.size).toBe(1);
    const names = await adminDb().collection(COL.seekerUsernames).get();
    expect(names.size).toBe(1);
  });

  it("S11: a proof already spent on one number can't be replayed on another", async () => {
    const p = proof();
    await signInSeeker(p);
    await expect(signInSeeker({ ...p, phone: "+8801812345678" })).rejects.toThrow();
    expect((await adminDb().collection(COL.seekers).get()).size).toBe(1);
  });

  it("loadSeeker reads back the live record, and null once it's gone", async () => {
    const { id, username } = await signInSeeker(proof());
    expect(await loadSeeker(id)).toEqual({ id, username, suspended: false });
    await adminDb().collection(COL.seekers).doc(id).delete();
    expect(await loadSeeker(id)).toBeNull();
  });
});
