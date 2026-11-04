import "server-only";
import { loadDirectory } from "./directory";
import { loadVisits } from "./visits";

// The two numbers in the hero band.
//
//   available - donors marked available right now. The directory IS that list (toEntry() drops
//               anyone whose `available` is not true), so its length is the count, taken from
//               the same cached read /api/search uses. Costs nothing extra.
//   visits    - how many browser sessions the homepage has counted (see visits.ts).
//
// No "registered donors" tile any more. It overlapped with `available`, cost an extra Firestore
// aggregate, and made a small directory read as a shortfall rather than a standing offer.

export interface HeroStatsData {
  /** Donors available right now: exactly who a search would return. */
  available: number;
  /** Recorded visits. A floor, not a measurement - see visits.ts. */
  visits: number;
}

/**
 * Both numbers, or null when the read failed. Null rather than zero: a hero announcing "0" is
 * worse than a hero with no tiles, and a Firestore hiccup must never take the homepage down.
 *
 * There is no minimum any more. One available donor is worth showing - someone who needs blood
 * needs one person, not fifty - and the visitor count carries the "this place is used" weight
 * that the old threshold was trying to protect.
 */
export async function heroStats(): Promise<HeroStatsData | null> {
  try {
    const [directory, visits] = await Promise.all([loadDirectory(), loadVisits()]);
    return { available: directory.length, visits };
  } catch {
    return null;
  }
}
