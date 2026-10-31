import "server-only";
import { FieldValue, Timestamp, type DocumentData, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { LOCATION_GRID_METERS } from "@/config/app";
import type { BloodGroup } from "@/lib/bloodGroups";
import { adminDb } from "@/lib/firebase/admin";
import { snapGeoPoint, type GeoPoint } from "@/lib/geo";
import type { EditableProfile } from "@/lib/types";
import { invalidateDirectory } from "./directory";
import { ApiError } from "./http";
import { COL, phoneKey } from "./keys";
import { claimProof, verifyPhoneProof } from "./otp";
import { generateEditToken, hashToken, TOKEN_PATTERN } from "./token";

// donors/{id}           PRIVATE (S2). Only the server reads it; search is served from a cache.
// donorSecrets/{id}     PRIVATE. Hash of the edit token.
// phoneIndex/{sha(ph)}  PRIVATE. { donorId }: the single source of truth for "one profile per phone".
// Every ownership check and the mutation it guards happen inside ONE transaction (D1, D2, D3).

export interface DonorFields {
  name: string;
  bloodGroup: BloodGroup;
  area: string;
  available: boolean;
  lastDonated: Date | null;
  /** Shape/bounds-validated by the caller; snapped to the grid here, right before it's written. */
  location: GeoPoint | null;
}

const ts = (d: Date | null) => (d ? Timestamp.fromDate(d) : null);
export const publicPoint = (p: GeoPoint | null) => (p ? snapGeoPoint(p, LOCATION_GRID_METERS) : null);

const db = () => adminDb();
const donorRef = (id: string) => db().collection(COL.donors).doc(id);
const secretRef = (id: string) => db().collection(COL.secrets).doc(id);
const indexRef = (phone: string) => db().collection(COL.phoneIndex).doc(phoneKey(phone));
const blockedRef = (phone: string) => db().collection(COL.blocked).doc(phoneKey(phone));

/**
 * Register: creates the donor for the proof's phone, or updates the one already holding it.
 * A NEW edit token is issued either way; any previous link stops working.
 */
export async function registerDonor(proofInput: unknown, fields: DonorFields): Promise<{ editToken: string; existing: boolean }> {
  const proof = verifyPhoneProof(proofInput, "register");
  const phone = proof.phone;
  const editToken = generateEditToken();
  const tokenHash = hashToken(editToken);

  const result = await db().runTransaction(async (tx) => {
    const [index, blocked] = await Promise.all([tx.get(indexRef(phone)), tx.get(blockedRef(phone))]);
    if (blocked.exists) throw new ApiError(403, "phone_blocked");
    const claim = await claimProof(tx, proof, phone);
    const existingId = index.data()?.donorId as string | undefined;
    const existing = existingId ? await tx.get(donorRef(existingId)) : null;

    const now = FieldValue.serverTimestamp();
    const data = {
      name: fields.name,
      bloodGroup: fields.bloodGroup,
      area: fields.area,
      available: fields.available,
      lastDonated: ts(fields.lastDonated),
      location: publicPoint(fields.location),
      consentAt: now,
      updatedAt: now,
    };
    claim.commit();
    if (existing?.exists) {
      tx.update(existing.ref, data);
      tx.set(secretRef(existing.id), { tokenHash, rotatedAt: now });
      return { editToken, existing: true };
    }
    const ref = db().collection(COL.donors).doc();
    tx.set(ref, { ...data, phone, createdAt: now });
    tx.set(secretRef(ref.id), { tokenHash, rotatedAt: now });
    tx.set(indexRef(phone), { donorId: ref.id });
    return { editToken, existing: false };
  });
  invalidateDirectory();
  return result;
}

/** Lost-link recovery (D2): index -> donor -> phone match -> new secret, atomically. */
export async function recoverEditToken(proofInput: unknown): Promise<string> {
  const proof = verifyPhoneProof(proofInput, "recover");
  const editToken = generateEditToken();
  await db().runTransaction(async (tx) => {
    const index = await tx.get(indexRef(proof.phone));
    const donorId = index.data()?.donorId as string | undefined;
    const donor = donorId ? await tx.get(donorRef(donorId)) : null;
    if (!donor?.exists || donor.data()?.phone !== proof.phone) throw new ApiError(404, "no_profile");
    const claim = await claimProof(tx, proof, proof.phone);
    claim.commit();
    tx.set(secretRef(donor.id), { tokenHash: hashToken(editToken), rotatedAt: FieldValue.serverTimestamp() });
  });
  return editToken;
}

/**
 * D3: resolves an edit token to its donor INSIDE the caller's transaction, so a token rotated by
 * /recover (or a deleted profile) can't still commit a change that started a moment earlier.
 */
async function authorize(tx: Transaction, token: unknown): Promise<{ ref: DocumentReference; data: DocumentData }> {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) throw new ApiError(404, "link_invalid");
  const found = await tx.get(db().collection(COL.secrets).where("tokenHash", "==", hashToken(token)).limit(1));
  if (found.empty) throw new ApiError(404, "link_invalid");
  const donor = await tx.get(donorRef(found.docs[0].id));
  if (!donor.exists) throw new ApiError(404, "link_invalid");
  return { ref: donor.ref, data: donor.data()! };
}

export async function loadProfileByToken(token: unknown): Promise<EditableProfile> {
  return db().runTransaction(async (tx) => toEditable((await authorize(tx, token)).data), { readOnly: true });
}

export interface ProfilePatch {
  available?: boolean;
  lastDonated?: Date | null;
  area?: string;
  location?: GeoPoint | null;
  name?: string;
  bloodGroup?: BloodGroup;
  /** New phone: needs a fresh change_phone proof for exactly that number. */
  phone?: { phone: string; proof: unknown };
}

export async function updateProfileByToken(token: unknown, patch: ProfilePatch): Promise<EditableProfile> {
  const proof = patch.phone ? verifyPhoneProof(patch.phone.proof, "change_phone") : null;
  if (proof && proof.phone !== patch.phone!.phone) throw new ApiError(401, "otp_invalid");

  const profile = await db().runTransaction(async (tx) => {
    const { ref, data } = await authorize(tx, token);
    const updates: Record<string, unknown> = {};
    if (patch.available !== undefined) updates.available = patch.available;
    if (patch.lastDonated !== undefined) updates.lastDonated = ts(patch.lastDonated);
    if (patch.area !== undefined) updates.area = patch.area;
    if (patch.location !== undefined) updates.location = publicPoint(patch.location);
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.bloodGroup !== undefined) updates.bloodGroup = patch.bloodGroup;

    let phoneWrites: (() => void) | null = null;
    if (proof && proof.phone !== data.phone) phoneWrites = await preparePhoneChange(tx, ref.id, data.phone, proof);
    if (Object.keys(updates).length === 0 && !phoneWrites) throw new ApiError(400, "bad_request");

    phoneWrites?.();
    if (phoneWrites) updates.phone = proof!.phone;
    updates.updatedAt = FieldValue.serverTimestamp();
    tx.update(ref, updates);
    return toEditable({ ...data, ...updates, lastDonated: "lastDonated" in updates ? updates.lastDonated : data.lastDonated });
  });
  invalidateDirectory();
  return profile;
}

/** Reads (new index, old index, blocklist, proof) now; returns the writes to run afterwards. */
async function preparePhoneChange(
  tx: Transaction,
  donorId: string,
  oldPhone: string,
  proof: ReturnType<typeof verifyPhoneProof>,
): Promise<() => void> {
  const [newIndex, oldIndex, blocked] = await Promise.all([
    tx.get(indexRef(proof.phone)),
    tx.get(indexRef(oldPhone)),
    tx.get(blockedRef(proof.phone)),
  ]);
  if (blocked.exists) throw new ApiError(403, "phone_blocked");
  const holder = newIndex.data()?.donorId as string | undefined;
  if (holder && holder !== donorId) throw new ApiError(409, "phone_taken");
  const claim = await claimProof(tx, proof, donorId);
  return () => {
    claim.commit();
    tx.set(indexRef(proof.phone), { donorId });
    if (oldIndex.data()?.donorId === donorId) tx.delete(oldIndex.ref);
  };
}

export async function deleteProfileByToken(token: unknown): Promise<void> {
  await db().runTransaction(async (tx) => {
    const { ref, data } = await authorize(tx, token);
    const index = await tx.get(indexRef(String(data.phone)));
    tx.delete(ref);
    tx.delete(secretRef(ref.id));
    if (index.data()?.donorId === ref.id) tx.delete(index.ref);
  });
  invalidateDirectory();
}

/** Admin delete (optionally blocking the number from coming back, L2). Atomic with the index. */
export async function deleteDonorById(id: string, block: { reason: string } | null): Promise<{ deleted: boolean }> {
  const out = await db().runTransaction(async (tx) => {
    const snap = await tx.get(donorRef(id));
    if (!snap.exists) return { deleted: false };
    const phone = String(snap.data()!.phone ?? "");
    const index = phone ? await tx.get(indexRef(phone)) : null;
    tx.delete(snap.ref);
    tx.delete(secretRef(id));
    if (index?.data()?.donorId === id) tx.delete(index.ref);
    if (block && phone) tx.set(blockedRef(phone), { reason: block.reason, at: FieldValue.serverTimestamp() });
    return { deleted: true };
  });
  invalidateDirectory();
  return out;
}

/** One phone number, on purpose, for one donor who is currently available (S2 reveal). */
export async function revealPhone(id: string): Promise<string> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) throw new ApiError(404, "not_found");
  const snap = await donorRef(id).get();
  const d = snap.data();
  if (!d || d.available !== true || typeof d.phone !== "string") throw new ApiError(404, "not_found");
  return d.phone;
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
    lastDonated: last && typeof last.toDate === "function" ? last.toDate().toISOString().slice(0, 10) : null,
    location: location ?? null,
  };
}
