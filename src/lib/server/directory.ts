import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { SEARCH_CACHE_SECONDS } from "@/config/app";
import { isBloodGroup, type BloodGroup } from "@/lib/bloodGroups";
import { adminDb } from "@/lib/firebase/admin";
import { isValidGeoPoint, type GeoPoint } from "@/lib/geo";
import { COL } from "./keys";

// S2 + S4: the public directory is read on the SERVER, once per cache period, and every search is
// answered from that one cached copy. Firestore reads scale with time and writes, not visitors.
// Phones stay in this server-side copy but leave it only in "public" mode (owner decision #1); in
// "tap" mode they are revealed one at a time by /api/donors/:id/contact.

export interface DirectoryEntry {
  id: string;
  name: string;
  bloodGroup: BloodGroup;
  area: string;
  lastDonated: string | null; // YYYY-MM-DD
  location: GeoPoint | null; // already grid-snapped when written
  phone: string;
}

const TAG = "donor-directory";

async function readDirectory(): Promise<DirectoryEntry[]> {
  const snap = await adminDb()
    .collection(COL.donors)
    .where("available", "==", true) // unavailable donors never leave the server (owner decision #2)
    .select("name", "bloodGroup", "area", "lastDonated", "location", "phone")
    .get();
  const out: DirectoryEntry[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!isBloodGroup(d.bloodGroup)) continue;
    const last = d.lastDonated as { toDate?: () => Date } | null;
    out.push({
      id: doc.id,
      name: String(d.name ?? ""),
      bloodGroup: d.bloodGroup,
      area: String(d.area ?? ""),
      lastDonated: last?.toDate ? last.toDate().toISOString().slice(0, 10) : null,
      location: isValidGeoPoint(d.location) ? d.location : null,
      phone: String(d.phone ?? ""),
    });
  }
  return out;
}

export const loadDirectory = unstable_cache(readDirectory, ["donor-directory-v1"], {
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
