import type { GeoPoint } from "./geo";

// Chittagong District areas. `id` is what gets stored in Firestore and matched in search;
// `label` is what people see. Karnaphuli exists in both the city and the upazila list,
// so ids (not labels) must be used for matching.
export type AreaGroup = "city" | "district";

export interface Area {
  id: string;
  /** English label. */
  label: string;
  /** Bangla label (E2). PENDING OWNER: have a local check the spellings. */
  labelBn: string;
  /** Other common spellings people type, in either script. */
  aliases: readonly string[];
  group: AreaGroup;
  /**
   * Approximate center point, used only as a fallback for "nearest donor" sorting when a donor
   * hasn't shared their own exact location. These are rough thana/upazila centers, good enough
   * to rank areas by proximity - not surveyed, and not shown to anyone.
   */
  center: GeoPoint;
}

const city = (id: string, label: string, labelBn: string, aliases: string[], center: GeoPoint): Area => ({
  id,
  label,
  labelBn,
  aliases,
  group: "city",
  center,
});
const district = (id: string, label: string, labelBn: string, aliases: string[], center: GeoPoint): Area => ({
  id,
  label,
  labelBn,
  aliases,
  group: "district",
  center,
});

export const AREAS: readonly Area[] = [
  // City (Chittagong Metro)
  city("kotwali", "Kotwali", "কোতোয়ালী", ["kotowali", "কোতোয়ালি"], { lat: 22.335, lng: 91.832 }),
  city("khulshi", "Khulshi", "খুলশী", ["kulshi", "খুলশি"], { lat: 22.3667, lng: 91.8 }),
  city("panchlaish", "Panchlaish", "পাঁচলাইশ", ["panchlais", "পাঁচলাইস"], { lat: 22.3667, lng: 91.813 }),
  city("pahartali", "Pahartali", "পাহাড়তলী", ["pahartoli", "পাহাড়তলি"], { lat: 22.355, lng: 91.785 }),
  city("halishahar", "Halishahar", "হালিশহর", ["halishohor"], { lat: 22.323, lng: 91.76 }),
  city("double-mooring", "Double Mooring", "ডবলমুরিং", ["doublemooring", "double moring"], { lat: 22.33, lng: 91.8 }),
  city("bandar", "Bandar", "বন্দর", ["port"], { lat: 22.315, lng: 91.77 }),
  city("bayazid-bostami", "Bayazid Bostami", "বায়েজিদ বোস্তামী", ["bayezid", "bayazid", "বায়েজিদ"], { lat: 22.385, lng: 91.79 }),
  city("chandgaon", "Chandgaon", "চান্দগাঁও", ["chandgao", "চাঁদগাঁও"], { lat: 22.36, lng: 91.77 }),
  city("bakalia", "Bakalia", "বাকলিয়া", ["bakolia"], { lat: 22.34, lng: 91.8 }),
  city("patenga", "Patenga", "পতেঙ্গা", ["potenga"], { lat: 22.25, lng: 91.785 }),
  city("akbar-shah", "Akbar Shah", "আকবর শাহ", ["akbarshah"], { lat: 22.345, lng: 91.77 }),
  city("epz", "EPZ", "ইপিজেড", ["export processing zone"], { lat: 22.32, lng: 91.775 }),
  city("chawkbazar", "Chawkbazar", "চকবাজার", ["chowkbazar", "chokbazar"], { lat: 22.363, lng: 91.828 }),
  city("karnaphuli-city", "Karnaphuli (city)", "কর্ণফুলী (শহর)", ["karnafuli", "কর্ণফুলি"], { lat: 22.3, lng: 91.78 }),
  city("sadarghat", "Sadarghat", "সদরঘাট", ["sadarghat"], { lat: 22.33, lng: 91.835 }),
  // District (Upazilas)
  district("hathazari", "Hathazari", "হাটহাজারী", ["hathhazari", "hathazary", "হাটহাজারি"], { lat: 22.509, lng: 91.809 }),
  district("raozan", "Raozan", "রাউজান", ["raujan"], { lat: 22.498, lng: 91.899 }),
  district("rangunia", "Rangunia", "রাঙ্গুনিয়া", ["ranguniya", "রাঙুনিয়া"], { lat: 22.4, lng: 92.01 }),
  district("boalkhali", "Boalkhali", "বোয়ালখালী", ["boalkhali", "বোয়ালখালি"], { lat: 22.32, lng: 91.96 }),
  district("patiya", "Patiya", "পটিয়া", ["potiya", "patia"], { lat: 22.296, lng: 91.977 }),
  district("anwara", "Anwara", "আনোয়ারা", ["anowara"], { lat: 22.216, lng: 91.846 }),
  district("chandanaish", "Chandanaish", "চন্দনাইশ", ["chandanaish", "chandanaesh"], { lat: 22.233, lng: 92.033 }),
  district("satkania", "Satkania", "সাতকানিয়া", ["satkaniya"], { lat: 22.108, lng: 92.047 }),
  district("banshkhali", "Banshkhali", "বাঁশখালী", ["banskhali", "বাঁশখালি"], { lat: 22.07, lng: 91.899 }),
  district("lohagara", "Lohagara", "লোহাগাড়া", ["lohagora"], { lat: 21.933, lng: 92.05 }),
  district("sitakunda", "Sitakunda", "সীতাকুণ্ড", ["sitakund", "সীতাকুন্ড"], { lat: 22.63, lng: 91.65 }),
  district("mirsharai", "Mirsharai", "মীরসরাই", ["mirsarai", "mirersarai", "মিরসরাই"], { lat: 22.766, lng: 91.585 }),
  district("fatikchhari", "Fatikchhari", "ফটিকছড়ি", ["fatikchari", "ফটিকছড়ী"], { lat: 22.669, lng: 91.729 }),
  district("sandwip", "Sandwip", "সন্দ্বীপ", ["sandweep", "shondip"], { lat: 22.485, lng: 91.433 }),
  district("karnaphuli-upazila", "Karnaphuli (upazila)", "কর্ণফুলী (উপজেলা)", ["karnafuli", "কর্ণফুলি"], { lat: 22.29, lng: 91.795 }),
];

const BY_ID = new Map(AREAS.map((a) => [a.id, a]));

export function getArea(id: string): Area | undefined {
  return BY_ID.get(id);
}

export function isValidAreaId(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

/** The label for the page's language. */
export function areaLabel(id: string, locale: "bn" | "en"): string {
  const a = BY_ID.get(id);
  if (!a) return id;
  return locale === "bn" ? a.labelBn : a.label;
}

/** Lower-cased, accents/diacritics and spaces/hyphens folded, Bengali NFC-normalised. */
export function foldForSearch(v: string): string {
  return v
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Latin accents only; Bengali signs are kept
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s\-_.()]/g, "");
}

/** Matches English label, Bangla label and common alternative spellings (E2). Empty = everything. */
export function filterAreas(query: string): Area[] {
  const q = foldForSearch(query);
  if (!q) return [...AREAS];
  return AREAS.filter((a) => [a.label, a.labelBn, ...a.aliases].some((name) => foldForSearch(name).includes(q)));
}
