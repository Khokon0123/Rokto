import "server-only";
import { FieldValue, Timestamp, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { BloodGroup } from "@/lib/bloodGroups";
import { fuzzGeoPoint, type GeoPoint } from "@/lib/geo";
import type { EditableProfile } from "@/lib/types";
import { generateEditToken, hashToken, TOKEN_PATTERN } from "./token";

// donors/{id}        PUBLIC read (search). All writes go through the API routes (Admin SDK).
// donorSecrets/{id}  PRIVATE. Holds the hash of the edit token. Clients can never read or write it.
const DONORS = "donors";
const SECRETS = "donorSecrets";

export interface DonorFields {
  name: string;
  bloodGroup: BloodGroup;
  area: string;
  available: boolean;
  lastDonated: Date | null;
  /** Already shape/bounds-validated by the caller; fuzzed here, right before it's written. */
  location: GeoPoint | null;
}

const ts = (d: Date | null) => (d ? Timestamp.fromDate(d) : null);

/**
 * Creates a donor, or - if this verified phone already has one - updates it.
 * Either way a NEW edit token is issued and any previous link stops working.
 * Runs in a transaction so a double-submit can't create two profiles for one phone.
 */
export async function upsertDonorByPhone(
  phone: string,
  fields: DonorFields,
): Promise<{ editToken: string; existing: boolean }> {
  const db = adminDb();
  const editToken = generateEditToken();
  const tokenHash = hashToken(editToken);

  return db.runTransaction(async (tx) => {
    const found = await tx.get(db.collection(DONORS).where("phone", "==", phone).limit(1));
    const now = FieldValue.serverTimestamp();
    const data = {
      name: fields.name,
      bloodGroup: fields.bloodGroup,
      area: fields.area,
      available: fields.available,
      lastDonated: ts(fields.lastDonated),
      location: fields.location ? fuzzGeoPoint(fields.location) : null,
      phoneVerified: true,
      consentAt: now,
      updatedAt: now,
    };

    if (!found.empty) {
      const ref = found.docs[0].ref;
      tx.update(ref, data);
      tx.set(db.collection(SECRETS).doc(ref.id), { tokenHash, rotatedAt: now });
      return { editToken, existing: true };
    }

    const ref = db.collection(DONORS).doc();
    tx.set(ref, { ...data, phone, createdAt: now });
    tx.set(db.collection(SECRETS).doc(ref.id), { tokenHash, rotatedAt: now });
    return { editToken, existing: false };
  });
}

/** Lost-link recovery: after OTP, issue a fresh token for this phone's profile (null if none). */
export async function rotateTokenByPhone(phone: string): Promise<string | null> {
  const db = adminDb();
  const found = await db.collection(DONORS).where("phone", "==", phone).limit(1).get();
  if (found.empty) return null;
  const editToken = generateEditToken();
  await db
    .collection(SECRETS)
    .doc(found.docs[0].id)
    .set({ tokenHash: hashToken(editToken), rotatedAt: FieldValue.serverTimestamp() });
  return editToken;
}

export async function findDonorRefByToken(token: unknown): Promise<DocumentReference | null> {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  const db = adminDb();
  const found = await db.collection(SECRETS).where("tokenHash", "==", hashToken(token)).limit(1).get();
  return found.empty ? null : db.collection(DONORS).doc(found.docs[0].id);
}

export async function phoneTakenByOther(phone: string, ownId: string): Promise<boolean> {
  const found = await adminDb().collection(DONORS).where("phone", "==", phone).limit(2).get();
  return found.docs.some((d) => d.id !== ownId);
}

export function toEditable(data: DocumentData): EditableProfile {
  const last = data.lastDonated as Timestamp | null;
  const location = data.location as GeoPoint | null | undefined;
  return {
    name: data.name,
    phone: data.phone,
    bloodGroup: data.bloodGroup,
    area: data.area,
    available: data.available,
    lastDonated: last ? last.toDate().toISOString().slice(0, 10) : null,
    location: location ?? null,
  };
}

export async function deleteDonor(id: string): Promise<void> {
  const db = adminDb();
  const batch = db.batch();
  batch.delete(db.collection(DONORS).doc(id));
  batch.delete(db.collection(SECRETS).doc(id));
  await batch.commit();
}

export interface AdminDonorRecord {
  id: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  area: string;
  available: boolean;
  lastDonated: Date | null;
  location: GeoPoint | null;
  createdAt: Date | null;
}

/** Every donor, every field - for the admin panel only. Never exposed to the public API/client SDK. */
export async function listAllDonors(): Promise<AdminDonorRecord[]> {
  const db = adminDb();
  const snap = await db.collection(DONORS).orderBy("createdAt", "desc").get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    const last = d.lastDonated as Timestamp | null;
    const created = d.createdAt as Timestamp | null | undefined;
    return {
      id: doc.id,
      name: String(d.name ?? ""),
      phone: String(d.phone ?? ""),
      bloodGroup: d.bloodGroup as BloodGroup,
      area: String(d.area ?? ""),
      available: Boolean(d.available),
      lastDonated: last ? last.toDate() : null,
      location: (d.location as GeoPoint | null) ?? null,
      createdAt: created ? created.toDate() : null,
    };
  });
}

export { ts as toTimestamp };
