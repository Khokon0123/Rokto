import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { ADMIN_MIN_PASSWORD_LENGTH } from "@/config/app";
import { adminDb } from "@/lib/firebase/admin";
import { ApiError } from "./http";
import { COL, sha256 } from "./keys";

// adminUsers/{sha256(email)} - one login per person, so the audit trail can say WHO deleted a
// donor instead of just "admin". The document id is a hash: an account's existence should not be
// readable from a list of document names.
//
// scrypt with a per-user salt, from Node's own crypto - no new dependency, and deliberately slow,
// so a stolen database does not hand over the passwords. The hash is compared in constant time.

const SCRYPT = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const userRef = (email: string) => adminDb().collection(COL.adminUsers).doc(sha256(normalizeEmail(email)));
const derive = (password: string, salt: string) => scryptSync(password, salt, KEY_LENGTH, SCRYPT);

export interface AdminUser {
  email: string;
  disabled: boolean;
}

interface AdminUserDoc {
  email: string;
  salt: string;
  hash: string;
  disabled?: boolean;
  createdAt?: Timestamp;
  lastLoginAt?: Timestamp;
}

/** Creates the login, or replaces the password of one that exists. Used by `npm run admin:add`. */
export async function upsertAdminUser(emailInput: string, password: string): Promise<{ email: string; created: boolean }> {
  const email = normalizeEmail(emailInput);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That does not look like an email address.");
  if (password.length < ADMIN_MIN_PASSWORD_LENGTH) {
    throw new Error(`The password must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters.`);
  }

  const ref = userRef(email);
  const existing = await ref.get();
  const salt = randomBytes(16).toString("hex");
  await ref.set(
    {
      email,
      salt,
      hash: derive(password, salt).toString("hex"),
      disabled: false,
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
  return { email, created: !existing.exists };
}

/**
 * Checks an email and password. Returns null for every kind of failure - wrong password, no such
 * account, disabled - so the answer never says which, and a wrong email costs the same work as a
 * wrong password (the dummy derive below), leaving no timing signal that an account exists.
 */
export async function verifyAdminUser(emailInput: unknown, password: unknown): Promise<AdminUser | null> {
  if (typeof emailInput !== "string" || typeof password !== "string") return null;
  if (emailInput.length > 320 || password.length > 512) return null;

  const snap = await userRef(emailInput).get();
  const doc = snap.data() as AdminUserDoc | undefined;
  if (!doc) {
    derive(password, "no-such-account"); // same cost as a real check
    return null;
  }
  const want = Buffer.from(doc.hash, "hex");
  const got = derive(password, doc.salt);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  if (doc.disabled) return null;

  await snap.ref.update({ lastLoginAt: FieldValue.serverTimestamp() });
  return { email: doc.email, disabled: false };
}

/** For the admin panel's own list of logins. */
export async function listAdminUsers(): Promise<Array<AdminUser & { createdAt: string | null; lastLoginAt: string | null }>> {
  const snap = await adminDb().collection(COL.adminUsers).get();
  return snap.docs
    .map((d) => d.data() as AdminUserDoc)
    .map((d) => ({
      email: d.email,
      disabled: !!d.disabled,
      createdAt: d.createdAt?.toDate?.().toISOString() ?? null,
      lastLoginAt: d.lastLoginAt?.toDate?.().toISOString() ?? null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

/** True while this login exists and is not disabled: lets a disabled admin lose a live session. */
export async function isAdminUserActive(emailInput: string): Promise<boolean> {
  const snap = await userRef(emailInput).get();
  return snap.exists && !(snap.data() as AdminUserDoc).disabled;
}

/** Turns a login off without deleting it, so the audit trail keeps pointing at a real person. */
export async function setAdminUserDisabled(emailInput: string, disabled: boolean): Promise<void> {
  const ref = userRef(emailInput);
  if (!(await ref.get()).exists) throw new ApiError(404, "not_found");
  await ref.update({ disabled });
}
