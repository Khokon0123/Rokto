// Chittagong District areas. `id` is what gets stored in Firestore and matched in search;
// `label` is what people see. Karnaphuli exists in both the city and the upazila list,
// so ids (not labels) must be used for matching.
export type AreaGroup = "city" | "district";

export interface Area {
  id: string;
  label: string;
  group: AreaGroup;
}

const city = (id: string, label: string): Area => ({ id, label, group: "city" });
const district = (id: string, label: string): Area => ({ id, label, group: "district" });

export const AREAS: readonly Area[] = [
  // City (Chittagong Metro)
  city("kotwali", "Kotwali"),
  city("khulshi", "Khulshi"),
  city("panchlaish", "Panchlaish"),
  city("pahartali", "Pahartali"),
  city("halishahar", "Halishahar"),
  city("double-mooring", "Double Mooring"),
  city("bandar", "Bandar"),
  city("bayazid-bostami", "Bayazid Bostami"),
  city("chandgaon", "Chandgaon"),
  city("bakalia", "Bakalia"),
  city("patenga", "Patenga"),
  city("akbar-shah", "Akbar Shah"),
  city("epz", "EPZ"),
  city("chawkbazar", "Chawkbazar"),
  city("karnaphuli-city", "Karnaphuli (city)"),
  city("sadarghat", "Sadarghat"),
  // District (Upazilas)
  district("hathazari", "Hathazari"),
  district("raozan", "Raozan"),
  district("rangunia", "Rangunia"),
  district("boalkhali", "Boalkhali"),
  district("patiya", "Patiya"),
  district("anwara", "Anwara"),
  district("chandanaish", "Chandanaish"),
  district("satkania", "Satkania"),
  district("banshkhali", "Banshkhali"),
  district("lohagara", "Lohagara"),
  district("sitakunda", "Sitakunda"),
  district("mirsharai", "Mirsharai"),
  district("fatikchhari", "Fatikchhari"),
  district("sandwip", "Sandwip"),
  district("karnaphuli-upazila", "Karnaphuli (upazila)"),
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
