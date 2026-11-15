import { describe, expect, it } from "vitest";

const { adminDb } = await import("@/lib/firebase/admin");
const { COL, sha256 } = await import("@/lib/server/keys");
const { listAdminUsers, setAdminUserDisabled, upsertAdminUser, verifyAdminUser } = await import("@/lib/server/adminUsers");

const EMAIL = "baruakhokon01@gmail.com";
const PASSWORD = "a-long-enough-password";

describe("per-person admin logins", () => {
  it("creates a login and accepts only the right password", async () => {
    const { created } = await upsertAdminUser(EMAIL, PASSWORD);
    expect(created).toBe(true);

    expect(await verifyAdminUser(EMAIL, PASSWORD)).toEqual({ email: EMAIL, disabled: false });
    expect(await verifyAdminUser(EMAIL, "a-long-enough-passwore")).toBeNull();
    expect(await verifyAdminUser("someone@else.com", PASSWORD)).toBeNull();
    expect(await verifyAdminUser(EMAIL, "")).toBeNull();
    expect(await verifyAdminUser(null, PASSWORD)).toBeNull();
  });

  it("never stores the password itself", async () => {
    await upsertAdminUser(EMAIL, PASSWORD);
    const doc = (await adminDb().collection(COL.adminUsers).doc(sha256(EMAIL)).get()).data()!;
    expect(JSON.stringify(doc)).not.toContain(PASSWORD);
    expect(doc.salt).toHaveLength(32);
    expect(doc.hash).toHaveLength(128); // scrypt, 64 bytes as hex
  });

  it("two people with the same password get different hashes", async () => {
    await upsertAdminUser(EMAIL, PASSWORD);
    await upsertAdminUser("other@example.com", PASSWORD);
    const docs = await adminDb().collection(COL.adminUsers).get();
    const hashes = docs.docs.map((d) => d.data().hash);
    expect(new Set(hashes).size).toBe(2); // per-user salt doing its job
  });

  it("the email is case- and space-insensitive", async () => {
    await upsertAdminUser("  BaruaKhokon01@Gmail.com ", PASSWORD);
    expect(await verifyAdminUser(EMAIL, PASSWORD)).toMatchObject({ email: EMAIL });
    expect((await adminDb().collection(COL.adminUsers).get()).size).toBe(1);
  });

  it("running it again changes the password instead of making a second login", async () => {
    await upsertAdminUser(EMAIL, PASSWORD);
    const { created } = await upsertAdminUser(EMAIL, "a-different-long-password");
    expect(created).toBe(false);
    expect(await verifyAdminUser(EMAIL, PASSWORD)).toBeNull();
    expect(await verifyAdminUser(EMAIL, "a-different-long-password")).toMatchObject({ email: EMAIL });
    expect((await adminDb().collection(COL.adminUsers).get()).size).toBe(1);
  });

  it("a disabled login stops working but is still on the list", async () => {
    await upsertAdminUser(EMAIL, PASSWORD);
    await setAdminUserDisabled(EMAIL, true);
    expect(await verifyAdminUser(EMAIL, PASSWORD)).toBeNull();
    expect(await listAdminUsers()).toMatchObject([{ email: EMAIL, disabled: true }]);

    await setAdminUserDisabled(EMAIL, false);
    expect(await verifyAdminUser(EMAIL, PASSWORD)).toMatchObject({ email: EMAIL });
  });

  it("refuses a short password or a bad address, writing nothing", async () => {
    await expect(upsertAdminUser(EMAIL, "short")).rejects.toThrow(/at least/);
    await expect(upsertAdminUser("not-an-email", PASSWORD)).rejects.toThrow(/email/);
    expect((await adminDb().collection(COL.adminUsers).get()).size).toBe(0);
  });
});
