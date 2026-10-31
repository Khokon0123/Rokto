import { describe, expect, it } from "vitest";
import { adminDb } from "@/lib/firebase/admin";
import { migrate } from "../../scripts/migrate-lib";

describe("migration script", () => {
  it("dry run writes nothing; real run is idempotent and reports duplicates instead of merging", async () => {
    const db = adminDb();
    await db.collection("donors").doc("a").set({ phone: "+8801711111111", location: { lat: 22.3569, lng: 91.7832 } });
    await db.collection("donors").doc("b").set({ phone: "+8801722222222", location: null });
    await db.collection("donors").doc("c").set({ phone: "+8801722222222", location: null });
    await db.collection("otpChallenges").doc("x").set({ expiresAt: Date.now() });

    const dry = await migrate(db, { dryRun: true });
    expect(dry.indexCreated).toBe(1);
    expect(dry.duplicatePhones).toHaveLength(1);
    expect(dry.duplicatePhones[0].donorIds.sort()).toEqual(["b", "c"]);
    expect((await db.collection("phoneIndex").get()).size).toBe(0);

    const real = await migrate(db, { dryRun: false });
    expect(real.indexCreated).toBe(1);
    expect(real.locationsSnapped).toBe(1);
    expect(real.expireAtAdded.otpChallenges).toBe(1);
    const again = await migrate(db, { dryRun: false });
    expect(again.indexCreated).toBe(0);
    expect(again.indexOk).toBe(1);
    expect(again.locationsSnapped).toBe(0);
    expect(again.expireAtAdded.otpChallenges).toBe(0);
    expect((await db.collection("donors").get()).size).toBe(3); // nothing merged or deleted
    expect(again.directoryListed).toBe(0); // none of these test donors is "available"
  });
});
