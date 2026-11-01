import "server-only";
import { unstable_cache } from "next/cache";
import { SEARCH_CACHE_SECONDS } from "@/config/app";
import { adminDb } from "@/lib/firebase/admin";
import { loadDirectory } from "./directory";
import { COL } from "./keys";

// Counts for the homepage hero tiles. Read-only: nothing here writes, and no schema, API or
// query used by search changes. Two different numbers, so two different sources:
//
//   available  - the directory already IS the list of available donors (toEntry() drops anyone
//                whose `available` is not true), so its length is the count. This reuses the
//                exact cached read /api/search uses, which costs nothing extra.
//   registered - every donor, available or not. count() is an aggregation: Firestore bills it
//                per 1,000 documents scanned rather than per document, so it stays one read.
//
// Both are cached on the "donor-directory" tag, the same tag invalidateDirectory() clears after
// any donor write, so the tiles move when someone registers instead of lagging a cache period.

/** Below this many registered donors the tiles are hidden, so a thin directory doesn't advertise
 *  how thin it is. Change this one number to show them earlier. */
export const HERO_STATS_MIN_REGISTERED = 50;

export interface HeroStatsData {
  /** Every donor on record, available or not. */
  registered: number;
  /** Donors currently marked available: exactly who search would return. */
  available: number;
}

const readRegisteredCount = async (): Promise<number> => {
  const snap = await adminDb().collection(COL.donors).count().get();
  return snap.data().count;
};

const loadRegisteredCount = unstable_cache(readRegisteredCount, ["donor-registered-count-v1"], {
  revalidate: SEARCH_CACHE_SECONDS,
  tags: ["donor-directory"],
});

/**
 * Both counts, or null when the tiles must not render: too few donors, or the read failed.
 * Null rather than zero on purpose. A hero that announces "0 donors" is worse than a hero with
 * no tiles, and a Firestore hiccup must never take the homepage down with it.
 */
export async function heroStats(): Promise<HeroStatsData | null> {
  try {
    const [registered, directory] = await Promise.all([loadRegisteredCount(), loadDirectory()]);
    if (!Number.isFinite(registered) || registered < HERO_STATS_MIN_REGISTERED) return null;
    return { registered, available: directory.length };
  } catch {
    return null;
  }
}
