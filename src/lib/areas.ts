import type { GeoPoint } from "./geo";

// Chittagong District areas. `id` is what gets stored in Firestore and matched in search;
// `label` is what people see. Karnaphuli exists in both the city and the upazila list,
// so ids (not labels) must be used for matching.
export type AreaGroup = "city" | "district";

export interface Area {
  id: string;
  label: string;
  group: AreaGroup;
  /**
   * Approximate center point, used only as a fallback for "nearest donor" sorting when a donor
   * hasn't shared their own exact location. These are rough thana/upazila centers, good enough
   * to rank areas by proximity - not surveyed, and not shown to anyone.
   */
  center: GeoPoint;
}

const city = (id: string, label: string, center: GeoPoint): Area => ({ id, label, group: "city", center });
const district = (id: string, label: string, center: GeoPoint): Area => ({
  id,
  label,
  group: "district",
  center,
});

export const AREAS: readonly Area[] = [
  // City (Chittagong Metro)
  city("kotwali", "Kotwali", { lat: 22.335, lng: 91.832 }),
  city("khulshi", "Khulshi", { lat: 22.3667, lng: 91.8 }),
  city("panchlaish", "Panchlaish", { lat: 22.3667, lng: 91.813 }),
  city("pahartali", "Pahartali", { lat: 22.355, lng: 91.785 }),
  city("halishahar", "Halishahar", { lat: 22.323, lng: 91.76 }),
  city("double-mooring", "Double Mooring", { lat: 22.33, lng: 91.8 }),
  city("bandar", "Bandar", { lat: 22.315, lng: 91.77 }),
  city("bayazid-bostami", "Bayazid Bostami", { lat: 22.385, lng: 91.79 }),
  city("chandgaon", "Chandgaon", { lat: 22.36, lng: 91.77 }),
  city("bakalia", "Bakalia", { lat: 22.34, lng: 91.8 }),
  city("patenga", "Patenga", { lat: 22.25, lng: 91.785 }),
  city("akbar-shah", "Akbar Shah", { lat: 22.345, lng: 91.77 }),
  city("epz", "EPZ", { lat: 22.32, lng: 91.775 }),
  city("chawkbazar", "Chawkbazar", { lat: 22.363, lng: 91.828 }),
  city("karnaphuli-city", "Karnaphuli (city)", { lat: 22.3, lng: 91.78 }),
  city("sadarghat", "Sadarghat", { lat: 22.33, lng: 91.835 }),
  // District (Upazilas)
  district("hathazari", "Hathazari", { lat: 22.509, lng: 91.809 }),
  district("raozan", "Raozan", { lat: 22.498, lng: 91.899 }),
  district("rangunia", "Rangunia", { lat: 22.4, lng: 92.01 }),
  district("boalkhali", "Boalkhali", { lat: 22.32, lng: 91.96 }),
  district("patiya", "Patiya", { lat: 22.296, lng: 91.977 }),
  district("anwara", "Anwara", { lat: 22.216, lng: 91.846 }),
  district("chandanaish", "Chandanaish", { lat: 22.233, lng: 92.033 }),
  district("satkania", "Satkania", { lat: 22.108, lng: 92.047 }),
  district("banshkhali", "Banshkhali", { lat: 22.07, lng: 91.899 }),
  district("lohagara", "Lohagara", { lat: 21.933, lng: 92.05 }),
  district("sitakunda", "Sitakunda", { lat: 22.63, lng: 91.65 }),
  district("mirsharai", "Mirsharai", { lat: 22.766, lng: 91.585 }),
  district("fatikchhari", "Fatikchhari", { lat: 22.669, lng: 91.729 }),
  district("sandwip", "Sandwip", { lat: 22.485, lng: 91.433 }),
  district("karnaphuli-upazila", "Karnaphuli (upazila)", { lat: 22.29, lng: 91.795 }),
];

const BY_ID = new Map(AREAS.map((a) => [a.id, a]));

export function getArea(id: string): Area | undefined {
  return BY_ID.get(id);
}

export function isValidAreaId(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

/** Case-insensitive substring match anywhere in the label. Empty query returns everything. */
export function filterAreas(query: string): Area[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...AREAS];
  return AREAS.filter((a) => a.label.toLowerCase().includes(q));
}
