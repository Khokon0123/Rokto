export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export function isBloodGroup(v: unknown): v is BloodGroup {
  return typeof v === "string" && (BLOOD_GROUPS as readonly string[]).includes(v);
}

// Donor groups that can safely give red cells to a recipient of the key group.
const DONORS_FOR_RECIPIENT: Record<BloodGroup, readonly BloodGroup[]> = {
  "A+": ["A+", "A-", "O+", "O-"],
  "A-": ["A-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"],
  "AB-": ["AB-", "A-", "B-", "O-"],
  "O+": ["O+", "O-"],
  "O-": ["O-"],
};

export function compatibleDonorGroups(recipient: BloodGroup): readonly BloodGroup[] {
  return DONORS_FOR_RECIPIENT[recipient];
}
