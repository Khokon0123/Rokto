import { collection, getDocs, limit, query, where, Timestamp, type QueryConstraint } from "firebase/firestore";
import { SEARCH_LIMIT } from "@/config/app";
import { compatibleDonorGroups, isBloodGroup, type BloodGroup } from "./bloodGroups";
import { isCoolingDown } from "./donation";
import { clientDb } from "./firebase/client";
import type { Donor } from "./types";

export interface SearchParams {
  bloodGroup: BloodGroup | null; // null = any group
  area: string | null; // area id, null = all areas
  includeCompatible: boolean;
}

export interface SearchResult {
  donor: Donor;
  /** Gave blood recently: still listed and callable, but sorted below ready donors. */
  coolingDown: boolean;
  /** Same group as the one searched (false = a compatible group). */
  exact: boolean;
}

/**
 * The ONE place that reads donors. v1 queries Firestore straight from the browser (public read).
 * Future: swap this body for a fetch("/api/donors/search") to add rate limiting / caching
 * without touching any component.
 *
 * Only equality filters are used, so no composite index is needed. Ordering happens client-side.
 */
export async function searchDonors(params: SearchParams): Promise<SearchResult[]> {
  const constraints: QueryConstraint[] = [where("available", "==", true)];

  if (params.area) constraints.push(where("area", "==", params.area));
  if (params.bloodGroup) {
    const groups = params.includeCompatible ? compatibleDonorGroups(params.bloodGroup) : [params.bloodGroup];
    constraints.push(where("bloodGroup", "in", [...groups]));
  }

  const snap = await getDocs(query(collection(clientDb(), "donors"), ...constraints, limit(SEARCH_LIMIT)));
  const now = Date.now();

  const results: SearchResult[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!isBloodGroup(d.bloodGroup)) continue;
    const lastDonated = d.lastDonated instanceof Timestamp ? d.lastDonated.toDate() : null;
    results.push({
      donor: {
        id: doc.id,
        name: String(d.name ?? ""),
        phone: String(d.phone ?? ""),
        bloodGroup: d.bloodGroup,
        area: String(d.area ?? ""),
        available: true,
        lastDonated,
      },
      coolingDown: isCoolingDown(lastDonated, now),
      exact: !params.bloodGroup || d.bloodGroup === params.bloodGroup,
    });
  }
  return sortResults(results);
}

/** "Available now" first, then exact group before compatible, then longest since last donation. */
export function sortResults(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => {
    if (a.coolingDown !== b.coolingDown) return a.coolingDown ? 1 : -1;
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    const at = a.donor.lastDonated?.getTime() ?? 0; // never/unknown first
    const bt = b.donor.lastDonated?.getTime() ?? 0;
    if (at !== bt) return at - bt;
    return a.donor.name.localeCompare(b.donor.name);
  });
}
