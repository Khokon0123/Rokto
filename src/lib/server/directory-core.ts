// Pure parts of the search directory (no server-only imports), shared with scripts/migrate.ts.
import { createHash } from "node:crypto";
import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import { isBloodGroup, type BloodGroup } from "@/lib/bloodGroups";
import { isValidGeoPoint, type GeoPoint } from "@/lib/geo";

export const DIRECTORY_COLLECTION = "directory";
export const DIRECTORY_SHARDS = 4;
export interface DirectoryEntry {
  id: string;
  name: string;
  bloodGroup: BloodGroup;
  area: string;
  lastDonated: string | null; // YYYY-MM-DD
  location: GeoPoint | null; // already grid-snapped when written
  phone: string; // leaves the server only in "public" reveal mode
}

export function shardOf(donorId: string): string {
  return String(createHash("sha256").update(donorId).digest()[0] % DIRECTORY_SHARDS);
}

/** The directory row for a donor document, or null when it must not be listed. */
export function toEntry(id: string, d: DocumentData): Omit<DirectoryEntry, "id"> | null {
  if (d.available !== true || !isBloodGroup(d.bloodGroup) || typeof d.phone !== "string") return null;
  const last = d.lastDonated as Timestamp | null | undefined;
  return {
    name: String(d.name ?? ""),
    bloodGroup: d.bloodGroup,
    area: String(d.area ?? ""),
    lastDonated: last && typeof last.toDate === "function" ? last.toDate().toISOString().slice(0, 10) : null,
    location: isValidGeoPoint(d.location) ? d.location : null,
    phone: d.phone,
  };
}

