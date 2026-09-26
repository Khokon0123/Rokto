import type { BloodGroup } from "./bloodGroups";
import type { GeoPoint } from "./geo";

/** A donor as returned by public search (Firestore `donors` doc, public fields only). */
export interface Donor {
  id: string;
  name: string;
  phone: string; // E.164
  bloodGroup: BloodGroup;
  area: string; // area id
  available: boolean;
  lastDonated: Date | null;
  /** Optional, donor-provided, fuzzed to ~250m server-side before it's ever stored. */
  location: GeoPoint | null;
}

/** What the /edit page loads and edits (dates are YYYY-MM-DD strings). */
export interface EditableProfile {
  name: string;
  phone: string; // E.164
  bloodGroup: BloodGroup;
  area: string;
  available: boolean;
  lastDonated: string | null;
  location: GeoPoint | null;
}
