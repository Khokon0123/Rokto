import type { BloodGroup } from "./bloodGroups";

/** A donor as returned by public search (Firestore `donors` doc, public fields only). */
export interface Donor {
  id: string;
  name: string;
  phone: string; // E.164
  bloodGroup: BloodGroup;
  area: string; // area id
  available: boolean;
  lastDonated: Date | null;
}

/** What the /edit page loads and edits (dates are YYYY-MM-DD strings). */
export interface EditableProfile {
  name: string;
  phone: string; // E.164
  bloodGroup: BloodGroup;
  area: string;
  available: boolean;
  lastDonated: string | null;
}
