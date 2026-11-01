import "server-only";
import { FieldValue, type DocumentData, type Firestore, type Transaction } from "firebase-admin/firestore";
import { revalidateTag, unstable_cache } from "next/cache";
import { SEARCH_CACHE_SECONDS } from "@/config/app";
import { isBloodGroup } from "@/lib/bloodGroups";
import { adminDb } from "@/lib/firebase/admin";
import { DIRECTORY_COLLECTION, DIRECTORY_SHARDS, shardOf, toEntry, type DirectoryEntry } from "./directory-core";

export { DIRECTORY_SHARDS, shardOf, toEntry, type DirectoryEntry };

// S2 + S4: the public directory is a small, PRIVATE, pre-built copy of every AVAILABLE donor,
// kept in DIRECTORY_SHARDS documents (directory/0..n) and updated inside the same transaction as
// every donor write. Search reads those few documents once per cache period, so Firestore reads
// no longer scale with visitors OR with the number of donors:
//   reads/day ~= DIRECTORY_SHARDS x (86400 / SEARCH_CACHE_SECONDS + donor writes per day)
// Each shard holds ~8,000 donors before the 1 MiB document limit; raise DIRECTORY_SHARDS (and
// re-run `npm run migrate`) long before that.
const COLLECTION = DIRECTORY_COLLECTION;
const TAG = "donor-directory";

/** Write-phase helper: put (or remove) one donor's row. Never reads, so it fits any transaction. */
export function writeDirectory(tx: Transaction, db: Firestore, donorId: string, donor: DocumentData | null): void {
  const entry = donor ? toEntry(donorId, donor) : null;
  tx.set(
    db.collection(COLLECTION).doc(shardOf(donorId)),
    { entries: { [donorId]: entry ?? FieldValue.delete() } },
    { merge: true },
  );
}

async function readDirectory(): Promise<DirectoryEntry[]> {
  const db = adminDb();
  const refs = Array.from({ length: DIRECTORY_SHARDS }, (_, i) => db.collection(COLLECTION).doc(String(i)));
  const snaps = await db.getAll(...refs);
  const out: DirectoryEntry[] = [];
  for (const snap of snaps) {
    const entries = (snap.data()?.entries ?? {}) as Record<string, Omit<DirectoryEntry, "id">>;
    for (const [id, e] of Object.entries(entries)) if (e && isBloodGroup(e.bloodGroup)) out.push({ id, ...e });
  }
  return out;
}

export const loadDirectory = unstable_cache(readDirectory, ["donor-directory-v3"], {
  revalidate: SEARCH_CACHE_SECONDS,
  tags: [TAG],
});

/** Call after ANY donor write, so a donor who switches "available" off disappears at once. */
export function invalidateDirectory(): void {
  try {
    revalidateTag(TAG, { expire: 0 });
  } catch {
    /* outside a request scope (scripts, tests): nothing is cached there anyway */
  }
}
