import { describe, expect, it } from "vitest";

const { adminDb } = await import("@/lib/firebase/admin");
const { signInAccount, loadAccount, accountIdForPhone, accountByUsername, renameAccount } = await import("@/lib/server/accounts");
const { COL, phoneKey } = await import("@/lib/server/keys");

const PHONE = "+8801712345678";
let n = 0;
/** A verified-phone proof, as /api/account/signin hands it over after verifyPhoneProof(). */
const proof = (phone = PHONE, jti = `jti-${++n}`) => ({ phone, purpose: "signin" as const, jti, exp: Date.now() + 60_000 });

describe("account accounts", () => {
  it("one account per number: the second sign-in returns the SAME username", async () => {
    const first = await signInAccount(proof());
    expect(first.created).toBe(true);
    // The id is the account's own, NOT the phone hash: that is what lets the number change later
    // without the username and the history being orphaned.
    expect(first.id).not.toBe(phoneKey(PHONE));
    expect(await accountIdForPhone(PHONE)).toBe(first.id);

    const second = await signInAccount(proof());
    expect(second.created).toBe(false);
    expect(second.username).toBe(first.username);

    // Clearing cookies must not buy a fresh identity - that is the point of the audit trail.
    const all = await adminDb().collection(COL.accounts).get();
    expect(all.size).toBe(1);
  });

  it("claims the username so no one else can hold it", async () => {
    const { username } = await signInAccount(proof());
    const claim = await adminDb().collection(COL.usernames).doc(username).get();
    expect(claim.exists).toBe(true);
    expect(claim.data()?.accountId).toBe((await signInAccount(proof())).id);
  });

  it("two simultaneous sign-ins for one number create one account, not two", async () => {
    const out = await Promise.allSettled([signInAccount(proof()), signInAccount(proof())]);
    expect(out.filter((r) => r.status === "fulfilled").length).toBeGreaterThan(0);

    const all = await adminDb().collection(COL.accounts).get();
    expect(all.size).toBe(1);
    const names = await adminDb().collection(COL.usernames).get();
    expect(names.size).toBe(1);
  });

  it("S11: a proof already spent on one number can't be replayed on another", async () => {
    const p = proof();
    await signInAccount(p);
    await expect(signInAccount({ ...p, phone: "+8801812345678" })).rejects.toThrow();
    expect((await adminDb().collection(COL.accounts).get()).size).toBe(1);
  });

  it("loadAccount reads back the live record, and null once it's gone", async () => {
    const { id, username } = await signInAccount(proof());
    expect(await loadAccount(id)).toEqual({ id, username, suspended: false });
    await adminDb().collection(COL.accounts).doc(id).delete();
    expect(await loadAccount(id)).toBeNull();
  });

  it("a lookup left pointing at a deleted account makes a fresh one, not a crash", async () => {
    const first = await signInAccount(proof());
    await adminDb().collection(COL.accounts).doc(first.id).delete();

    const second = await signInAccount(proof());
    expect(second.created).toBe(true);
    expect(second.id).not.toBe(first.id);
    expect(await accountIdForPhone(PHONE)).toBe(second.id);
  });

  it("accountIdForPhone is null for a number nobody has used", async () => {
    expect(await accountIdForPhone("+8801999999999")).toBeNull();
  });
});

describe("usernames as the sign-in key", () => {
  it("finds the account by its username, and null for an unknown one", async () => {
    const a = await signInAccount(proof("+8801711111111"));
    expect((await accountByUsername(a.username))?.id).toBe(a.id);
    expect(await accountByUsername("nobody-here-0000")).toBeNull();
  });

  it("rename moves the claim: new name finds the account, old name is released", async () => {
    const a = await signInAccount(proof("+8801722222222"));
    await renameAccount(a.id, "my-new-name");
    expect((await accountByUsername("my-new-name"))?.id).toBe(a.id);
    expect(await accountByUsername(a.username)).toBeNull();
    expect((await loadAccount(a.id))?.username).toBe("my-new-name");
  });

  it("a name someone else holds is refused and nothing changes", async () => {
    const a = await signInAccount(proof("+8801733333333"));
    const b = await signInAccount(proof("+8801744444444"));
    await expect(renameAccount(b.id, a.username)).rejects.toMatchObject({ status: 409, code: "username_taken" });
    expect((await loadAccount(b.id))?.username).toBe(b.username);
    expect((await accountByUsername(a.username))?.id).toBe(a.id);
  });

  it("two accounts racing for one name: exactly one wins", async () => {
    const a = await signInAccount(proof("+8801755555555"));
    const b = await signInAccount(proof("+8801766666666"));
    const out = await Promise.allSettled([renameAccount(a.id, "race-name"), renameAccount(b.id, "race-name")]);
    expect(out.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const holder = await accountByUsername("race-name");
    expect([a.id, b.id]).toContain(holder?.id);
  });
});
