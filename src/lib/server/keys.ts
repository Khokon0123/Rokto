import "server-only";
import { createHash } from "node:crypto";

// Private Firestore collections and their document-id schemes, in one place.
export const COL = {
  donors: "donors", // PRIVATE since S2: only the server reads it
  secrets: "donorSecrets", // { tokenHash, rotatedAt }
  phoneIndex: "phoneIndex", // {sha256(phone)} -> { donorId }  (D1: one profile per phone)
  blocked: "blockedPhones", // {sha256(phone)} -> { reason, at }  (L2)
  challenges: "otpChallenges",
  usedProofs: "usedProofs", // {jti} -> { purpose, subject, uses, expireAt }  (S11)
  reports: "reports", // L2
  audit: "adminAudit", // S7
  directory: "directory", // {shard} -> { entries: { [donorId]: row } }  (S2/S4 search list)
  team: "team",
  meta: "meta",
} as const;

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const phoneKey = (phoneE164: string) => sha256(phoneE164);
