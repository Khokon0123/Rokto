import "server-only";
import { FieldValue, type Query, type Timestamp } from "firebase-admin/firestore";
import { ADMIN_PAGE_SIZE } from "@/config/app";
import { isValidAreaId } from "@/lib/areas";
import { isBloodGroup, type BloodGroup } from "@/lib/bloodGroups";
import { adminDb } from "@/lib/firebase/admin";
import type { GeoPoint } from "@/lib/geo";
import { normalizeBdPhone } from "@/lib/phone";
import { COL, phoneKey } from "./keys";

export interface AdminDonorRecord {
  id: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  area: string;
  available: boolean;
  lastDonated: string | null;
  location: GeoPoint | null;
  createdAt: string | null;
}

function toRecord(id: string, d: FirebaseFirestore.DocumentData): AdminDonorRecord {
  const last = d.lastDonated as Timestamp | null;
  const created = d.createdAt as Timestamp | null | undefined;
  return {
    id,
    name: String(d.name ?? ""),
    phone: String(d.phone ?? ""),
    bloodGroup: d.bloodGroup as BloodGroup,
    area: String(d.area ?? ""),
    available: Boolean(d.available),
    lastDonated: last ? last.toDate().toISOString().slice(0, 10) : null,
    location: (d.location as GeoPoint | null) ?? null,
    createdAt: created ? created.toDate().toISOString() : null,
  };
}

export interface AdminListFilters {
  bloodGroup?: unknown;
  area?: unknown;
  phone?: unknown;
  cursor?: unknown; // id of the last donor on the previous page
}

/**
 * H7: one page at a time, newest first, filtered in Firestore (not in the browser).
 * Phone search is an exact lookup through phoneIndex. Needs the composite indexes in
 * firestore.indexes.json (bloodGroup/area + createdAt desc).
 */
export async function listDonorsPage(f: AdminListFilters): Promise<{ donors: AdminDonorRecord[]; nextCursor: string | null }> {
  const db = adminDb();
  if (typeof f.phone === "string" && f.phone.trim()) {
    const phone = normalizeBdPhone(f.phone);
    if (!phone) return { donors: [], nextCursor: null };
    const index = await db.collection(COL.phoneIndex).doc(phoneKey(phone)).get();
    const id = index.data()?.donorId as string | undefined;
    const snap = id ? await db.collection(COL.donors).doc(id).get() : null;
    return { donors: snap?.exists ? [toRecord(snap.id, snap.data()!)] : [], nextCursor: null };
  }

  let q: Query = db.collection(COL.donors);
  if (isBloodGroup(f.bloodGroup)) q = q.where("bloodGroup", "==", f.bloodGroup);
  if (isValidAreaId(f.area)) q = q.where("area", "==", f.area);
  q = q.orderBy("createdAt", "desc");
  if (typeof f.cursor === "string" && /^[A-Za-z0-9]{1,40}$/.test(f.cursor)) {
    const last = await db.collection(COL.donors).doc(f.cursor).get();
    if (last.exists) q = q.startAfter(last);
  }
  const snap = await q.limit(ADMIN_PAGE_SIZE + 1).get();
  const docs = snap.docs.slice(0, ADMIN_PAGE_SIZE);
  return {
    donors: docs.map((d) => toRecord(d.id, d.data())),
    nextCursor: snap.docs.length > ADMIN_PAGE_SIZE ? docs[docs.length - 1].id : null,
  };
}

/** H4: full export for the manual backup routine (JSON; the admin page also offers CSV). */
export async function exportAllDonors(): Promise<AdminDonorRecord[]> {
  const snap = await adminDb().collection(COL.donors).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => toRecord(d.id, d.data()));
}

/** S7: who did what, when, from where. Private collection; never shown publicly. */
export async function writeAudit(action: string, target: string, ip: string, extra: Record<string, unknown> = {}): Promise<void> {
  await adminDb()
    .collection(COL.audit)
    .add({ action, target, ip, ...extra, at: FieldValue.serverTimestamp() });
}
