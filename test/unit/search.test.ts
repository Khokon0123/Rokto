import { describe, expect, it } from "vitest";
import { compatibleDonorGroups, isBloodGroup } from "@/lib/bloodGroups";
import { areaLabel, filterAreas } from "@/lib/areas";
import { parseSearchParams, searchQueryString, selectResults, sortByDistance, type DirectoryLike } from "@/lib/search";

const NOW = Date.parse("2026-10-31T00:00:00Z");
const entry = (id: string, bloodGroup: string, lastDonated: string | null, area = "kotwali"): DirectoryLike => ({
  id,
  name: `Donor ${id}`,
  bloodGroup,
  area,
  lastDonated,
  location: null,
});

describe("F5: sort BEFORE the cut", () => {
  it("ready donors are never dropped in favour of cooling-down ones", () => {
    const cooling = Array.from({ length: 10 }, (_, i) => entry(`c${i}`, "O+", "2026-10-20"));
    const ready = Array.from({ length: 3 }, (_, i) => entry(`r${i}`, "O+", null));
    const { results, total, truncated } = selectResults([...cooling, ...ready], { bloodGroup: "O+", area: null, includeCompatible: false }, NOW, 5);
    expect(total).toBe(13);
    expect(truncated).toBe(true);
    expect(results.slice(0, 3).map((r) => r.donor.id).sort()).toEqual(["r0", "r1", "r2"]);
    expect(results.every((r, i) => i < 3 || r.coolingDown)).toBe(true);
  });
  it("filters by group (exact or compatible) and area", () => {
    const all = [entry("1", "O-", null), entry("2", "A+", null), entry("3", "O-", null, "khulshi"), entry("4", "XX", null)];
    expect(selectResults(all, { bloodGroup: "O-", area: "kotwali", includeCompatible: false }, NOW).results.map((r) => r.donor.id)).toEqual(["1"]);
    const forAPlus = selectResults(all, { bloodGroup: "A+", area: null, includeCompatible: true }, NOW).results;
    expect(forAPlus.map((r) => r.donor.id)).toEqual(["2", "1", "3"]);
    expect(forAPlus[0].exact).toBe(true);
  });
});

describe("search params", () => {
  it("round-trips and ignores junk", () => {
    const p = parseSearchParams(new URLSearchParams("group=AB-&area=khulshi&compatible=1"));
    expect(p).toEqual({ bloodGroup: "AB-", area: "khulshi", includeCompatible: true });
    expect(parseSearchParams(new URLSearchParams(searchQueryString(p)))).toEqual(p);
    expect(parseSearchParams(new URLSearchParams("group=Z&area=mars&compatible=1"))).toEqual({
      bloodGroup: null,
      area: null,
      includeCompatible: false,
    });
  });
  it("sortByDistance keeps recent donors last", () => {
    const res = selectResults([entry("near", "O+", "2026-10-25"), entry("far", "O+", null, "sandwip")], { bloodGroup: null, area: null, includeCompatible: false }, NOW).results;
    const sorted = sortByDistance(res, { lat: 22.335, lng: 91.832 });
    expect(sorted.map((r) => r.donor.id)).toEqual(["far", "near"]);
  });
});

describe("blood groups", () => {
  it("O- can only receive O-; AB+ from everyone", () => {
    expect(compatibleDonorGroups("O-")).toEqual(["O-"]);
    expect(compatibleDonorGroups("AB+")).toHaveLength(8);
    expect(isBloodGroup("B-")).toBe(true);
    expect(isBloodGroup("b-")).toBe(false);
  });
});

describe("E2: areas in Bangla", () => {
  it("matches Bangla names and alternative spellings", () => {
    expect(filterAreas("কোতোয়ালী").map((a) => a.id)).toContain("kotwali");
    expect(filterAreas("chowk").map((a) => a.id)).toContain("chawkbazar");
    expect(filterAreas("Double-Mooring").map((a) => a.id)).toContain("double-mooring");
    expect(filterAreas("doublemooring").map((a) => a.id)).toContain("double-mooring");
    expect(filterAreas("").length).toBeGreaterThan(30);
  });
  it("labels follow the locale", () => {
    expect(areaLabel("patiya", "bn")).toBe("পটিয়া");
    expect(areaLabel("patiya", "en")).toBe("Patiya");
    expect(areaLabel("nowhere", "en")).toBe("nowhere");
  });
});
