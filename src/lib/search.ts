import { SEARCH_LIMIT } from "@/config/app";
import { getArea } from "./areas";
import { compatibleDonorGroups, isBloodGroup, type BloodGroup } from "./bloodGroups";
import { isCoolingDown } from "./donation";
import { haversineKm, isValidGeoPoint, type GeoPoint } from "./geo";
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
  /** Set only after sortByDistance() has run. */
  distanceKm?: number;
}

/** What /api/search returns (JSON-safe: dates as YYYY-MM-DD). */
export interface SearchResponse {
  donors: Array<Omit<Donor, "lastDonated" | "available"> & { lastDonated: string | null }>;
  total: number;
  truncated: boolean;
}

export interface DirectoryLike {
  id: string;
  name: string;
  bloodGroup: string;
  area: string;
  lastDonated: string | null;
  location: GeoPoint | null;
  phone?: string;
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

const toDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

/**
 * Filters, ranks, THEN cuts to SEARCH_LIMIT (F5: sorting after a cut could drop ready donors).
 * Pure: used by the server route and by the tests.
 */
export function selectResults(
  entries: DirectoryLike[],
  params: SearchParams,
  now = Date.now(),
  limit = SEARCH_LIMIT,
): { results: SearchResult[]; total: number; truncated: boolean } {
  const groups = params.bloodGroup
    ? new Set<string>(params.includeCompatible ? compatibleDonorGroups(params.bloodGroup) : [params.bloodGroup])
    : null;
  const matched: SearchResult[] = [];
  for (const e of entries) {
    if (!isBloodGroup(e.bloodGroup)) continue;
    if (params.area && e.area !== params.area) continue;
    if (groups && !groups.has(e.bloodGroup)) continue;
    const lastDonated = toDate(e.lastDonated);
    matched.push({
      donor: {
        id: e.id,
        name: e.name,
        phone: e.phone ?? "",
        bloodGroup: e.bloodGroup,
        area: e.area,
        available: true,
        lastDonated,
        location: isValidGeoPoint(e.location) ? e.location : null,
      },
      coolingDown: isCoolingDown(lastDonated, now),
      exact: !params.bloodGroup || e.bloodGroup === params.bloodGroup,
    });
  }
  const sorted = sortResults(matched);
  return { results: sorted.slice(0, limit), total: sorted.length, truncated: sorted.length > limit };
}

/** Parses /api/search query params; anything invalid falls back to "no filter". */
export function parseSearchParams(q: URLSearchParams): SearchParams {
  const group = q.get("group");
  const area = q.get("area");
  return {
    bloodGroup: isBloodGroup(group) ? group : null,
    area: area && getArea(area) ? area : null,
    includeCompatible: q.get("compatible") === "1" && isBloodGroup(group),
  };
}

/** Rebuilds client-side results from the API response. */
export function fromResponse(res: SearchResponse, params: SearchParams, now = Date.now()): SearchResult[] {
  return res.donors.map((d) => {
    const lastDonated = toDate(d.lastDonated);
    return {
      donor: { ...d, phone: d.phone ?? "", available: true, lastDonated },
      coolingDown: isCoolingDown(lastDonated, now),
      exact: !params.bloodGroup || d.bloodGroup === params.bloodGroup,
    };
  });
}

/**
 * Re-ranks by distance from `from` (opt-in: the searcher's own device location, used only in the
 * browser for this sort and never sent anywhere). Uses the donor's approximate location when they
 * shared one, otherwise their area's centre. Recent donors still sort to the bottom.
 */
export function sortByDistance(results: SearchResult[], from: GeoPoint): SearchResult[] {
  const distanceOf = (r: SearchResult): number => {
    const point = r.donor.location ?? getArea(r.donor.area)?.center ?? null;
    return point ? haversineKm(from, point) : Number.POSITIVE_INFINITY;
  };
  return [...results]
    .map((r) => ({ ...r, distanceKm: distanceOf(r) }))
    .sort((a, b) => {
      if (a.coolingDown !== b.coolingDown) return a.coolingDown ? 1 : -1;
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    });
}

export function searchQueryString(params: SearchParams): string {
  const q = new URLSearchParams();
  if (params.bloodGroup) q.set("group", params.bloodGroup);
  if (params.area) q.set("area", params.area);
  if (params.includeCompatible) q.set("compatible", "1");
  return q.toString();
}
