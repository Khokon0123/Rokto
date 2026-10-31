import { createHash } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { LOCATION_GRID_METERS } from "../src/config/app";
import { isValidGeoPoint, snapGeoPoint } from "../src/lib/geo";
import { DIRECTORY_SHARDS, shardOf, toEntry } from "../src/lib/server/directory-core";

// One-off, idempotent data migration for the audit fixes. Safe to run any number of times:
// every step only writes what is missing or different, and conflicts are REPORTED, never merged.
//   1. phoneIndex/{sha256(phone)} -> { donorId }   (D1)
//   2. donor locations snapped to the public grid   (S5)
//   3. expireAt Timestamps on private bookkeeping   (D5, for Firestore TTL policies)
//   4. directory/{shard}: the pre-built search list (S2/S4), rebuilt from the donors

export interface MigrationReport {
  dryRun: boolean;
  donors: number;
  indexCreated: number;
  indexOk: number;
  duplicatePhones: Array<{ phoneMasked: string; donorIds: string[] }>;
  indexConflicts: Array<{ phoneMasked: string; indexedDonorId: string; donorIds: string[] }>;
  locationsSnapped: number;
  expireAtAdded: { otpChallenges: number; rateLimits: number };
  directoryListed: number;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const mask = (p: string) => (p.length > 7 ? `${p.slice(0, 7)}****${p.slice(-3)}` : "****");

export async function migrate(db: Firestore, { dryRun }: { dryRun: boolean }): Promise<MigrationReport> {
  const report: MigrationReport = {
    dryRun,
    donors: 0,
    indexCreated: 0,
    indexOk: 0,
    duplicatePhones: [],
    indexConflicts: [],
    locationsSnapped: 0,
    expireAtAdded: { otpChallenges: 0, rateLimits: 0 },
    directoryListed: 0,
  };
  const donors = await db.collection("donors").get();
  report.donors = donors.size;

  // 1. phone index
  const byPhone = new Map<string, string[]>();
  for (const d of donors.docs) {
    const phone = d.data().phone;
    if (typeof phone !== "string" || !phone) continue;
    byPhone.set(phone, [...(byPhone.get(phone) ?? []), d.id]);
  }
  for (const [phone, ids] of byPhone) {
    if (ids.length > 1) {
      report.duplicatePhones.push({ phoneMasked: mask(phone), donorIds: ids });
      continue; // the admin decides which profile stays; nothing is written for this phone
    }
    const ref = db.collection("phoneIndex").doc(sha256(phone));
    const snap = await ref.get();
    const indexed = snap.data()?.donorId as string | undefined;
    if (indexed === ids[0]) {
      report.indexOk++;
    } else if (indexed) {
      report.indexConflicts.push({ phoneMasked: mask(phone), indexedDonorId: indexed, donorIds: ids });
    } else {
      report.indexCreated++;
      if (!dryRun) await ref.set({ donorId: ids[0] });
    }
  }

  // 2. grid-snapped locations
  for (const d of donors.docs) {
    const loc = d.data().location;
    if (!isValidGeoPoint(loc)) continue;
    const snapped = snapGeoPoint(loc, LOCATION_GRID_METERS);
    if (snapped.lat === loc.lat && snapped.lng === loc.lng) continue;
    report.locationsSnapped++;
    if (!dryRun) await d.ref.update({ location: snapped });
  }

  // 3. expireAt for TTL policies
  const challenges = await db.collection("otpChallenges").get();
  for (const c of challenges.docs) {
    const x = c.data();
    if (x.expireAt || typeof x.expiresAt !== "number") continue;
    report.expireAtAdded.otpChallenges++;
    if (!dryRun) await c.ref.update({ expireAt: Timestamp.fromMillis(x.expiresAt) });
  }
  const limits = await db.collection("rateLimits").get();
  for (const r of limits.docs) {
    const x = r.data();
    if (x.expireAt || typeof x.windowStart !== "number") continue;
    report.expireAtAdded.rateLimits++;
    // Old docs don't record their window; one day is the longest window any limit uses.
    if (!dryRun) await r.ref.update({ expireAt: Timestamp.fromMillis(x.windowStart + 86_400_000) });
  }
  // 4. directory: rebuilt from scratch each run (deterministic, so re-running changes nothing)
  const shards: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i < DIRECTORY_SHARDS; i++) shards[String(i)] = {};
  const fresh = dryRun ? donors : await db.collection("donors").get(); // after step 2's snapping
  for (const d of fresh.docs) {
    const entry = toEntry(d.id, d.data());
    if (!entry) continue;
    shards[shardOf(d.id)][d.id] = entry;
    report.directoryListed++;
  }
  if (!dryRun) {
    for (const [shard, entries] of Object.entries(shards)) await db.collection("directory").doc(shard).set({ entries });
  }
  return report;
}
