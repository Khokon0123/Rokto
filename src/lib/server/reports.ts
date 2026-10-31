import "server-only";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { REPORT_REASONS, type ReportReason } from "@/config/app";
import { adminDb } from "@/lib/firebase/admin";
import { ApiError } from "./http";
import { COL } from "./keys";

// L2: anyone can flag a listing (wrong number, not registered by the owner, harassment). The admin
// sees reports in the panel and can delete the donor and block the number from re-registering.

export function parseReason(v: unknown): ReportReason {
  if (typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v)) return v as ReportReason;
  throw new ApiError(400, "bad_request");
}

export function cleanNote(v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v !== "string") throw new ApiError(400, "bad_request");
  return v.replace(/\s+/g, " ").trim().slice(0, 500);
}

export async function createReport(donorId: string, reason: ReportReason, note: string, ipHash: string): Promise<void> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(donorId)) throw new ApiError(404, "not_found");
  const donor = await adminDb().collection(COL.donors).doc(donorId).get();
  if (!donor.exists) throw new ApiError(404, "not_found");
  await adminDb().collection(COL.reports).add({
    donorId,
    donorName: String(donor.data()?.name ?? ""),
    reason,
    note,
    ipHash,
    status: "open",
    at: FieldValue.serverTimestamp(),
  });
}

export interface ReportRecord {
  id: string;
  donorId: string;
  donorName: string;
  reason: ReportReason;
  note: string;
  at: string | null;
}

export async function listOpenReports(): Promise<ReportRecord[]> {
  const snap = await adminDb().collection(COL.reports).where("status", "==", "open").orderBy("at", "desc").limit(100).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      donorId: String(x.donorId),
      donorName: String(x.donorName ?? ""),
      reason: x.reason as ReportReason,
      note: String(x.note ?? ""),
      at: (x.at as Timestamp | null)?.toDate().toISOString() ?? null,
    };
  });
}

export async function closeReport(id: string, resolution: "dismissed" | "deleted"): Promise<void> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) throw new ApiError(404, "not_found");
  await adminDb().collection(COL.reports).doc(id).update({ status: resolution, closedAt: FieldValue.serverTimestamp() });
}
