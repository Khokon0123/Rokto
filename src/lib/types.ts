import type { BloodGroup } from "./bloodGroups";
import type { GeoPoint } from "./geo";

/** A donor as shown in search results. */
export interface Donor {
  id: string;
  name: string;
  /** E.164. Empty in "tap to reveal" mode until the visitor asks for this one number (S2). */
  phone: string;
  bloodGroup: BloodGroup;
  area: string; // area id
  available: boolean;
  lastDonated: Date | null;
  /** Optional, donor-provided, snapped to a ~500 m grid server-side before it's ever stored (S5). */
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
