import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { ACCOUNT_USERNAME_TRIES } from "@/config/app";
import { adminDb } from "@/lib/firebase/admin";
import { ApiError } from "./http";
import { COL, phoneKey } from "./keys";
import { claimProof, type ProofData } from "./otp";
import { generateUsername } from "./username";

// One account per person, for both jobs: looking for blood, and managing your own donor listing.
//
// The account has its own id, with accountPhones/{sha256(phone)} -> { accountId } beside it, the
// same shape donors already use (phoneIndex). Keying the account ON the phone hash would have been
// simpler, but then changing your number would mean a different document - a new account, a new
// username, and an audit trail orphaned from its owner. The lookup is repointable; the account,
// the username and the history are not.
//
// The phone is stored on the account because accountability is the point: when a donor reports
// harassment, the admin has to be able to say who called. /privacy says so in plain words.

export interface Account {
  id: string;
  username: string;
  suspended: boolean;
}

interface AccountDoc {
  username: string;
  phone: string;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  suspended: boolean;
  revealCount: number;
}

/**
 * Signs a verified phone in, creating the account on first use. Returns the SAME username every
 * time for a given number - someone who clears their cookies does not get a fresh identity, which
 * is what makes the audit trail worth keeping.
 *
 * The OTP proof is spent in this same transaction (S11), so a replayed proof cannot mint a second
 * account, and a failed write leaves the proof unspent for an honest retry.
 */
/**
 * Creates the account on first use, or returns the one this number already has. The SAME username
 * every time - someone who clears their cookies does not get a fresh identity, which is what makes
 * the audit trail worth keeping.
 *
 * No proof is claimed here: the caller has just checked a code texted to this number, which is a
 * stronger statement than a proof token. Callers holding only a proof use signInAccount instead.
 */
export async function ensureAccount(phoneE164: string): Promise<Account & { created: boolean }> {
  const db = adminDb();
  const lookupRef = db.collection(COL.accountPhones).doc(phoneKey(phoneE164));

  return db.runTransaction(async (tx) => {
    const lookup = await tx.get(lookupRef);
    const existingId = lookup.data()?.accountId as string | undefined;
    const existing = existingId ? await tx.get(db.collection(COL.accounts).doc(existingId)) : null;

    if (existing?.exists) {
      const data = existing.data() as AccountDoc;
      tx.update(existing.ref, { lastActiveAt: FieldValue.serverTimestamp() });
      return { id: existing.id, username: data.username, suspended: !!data.suspended, created: false };
    }

    let username: string | null = null;
    for (let i = 0; i < ACCOUNT_USERNAME_TRIES && !username; i++) {
      const candidate = generateUsername();
      const taken = await tx.get(db.collection(COL.usernames).doc(candidate));
      if (!taken.exists) username = candidate;
    }
    if (!username) throw new ApiError(503, "server_error");

    // A lookup pointing at an account that no longer exists (deleted) is replaced, not kept.
    const ref = db.collection(COL.accounts).doc();
    const now = FieldValue.serverTimestamp();
    tx.set(ref, { username, phone: phoneE164, createdAt: now, lastActiveAt: now, suspended: false, revealCount: 0 });
    tx.set(db.collection(COL.usernames).doc(username), { accountId: ref.id, at: now });
    tx.set(lookupRef, { accountId: ref.id, at: now });
    return { id: ref.id, username, suspended: false, created: true };
  });
}

/** Same thing for a caller holding a proof rather than a freshly checked code (S11). */
export async function signInAccount(proof: ProofData): Promise<Account & { created: boolean }> {
  await adminDb().runTransaction(async (tx) => {
    const claim = await claimProof(tx, proof, phoneKey(proof.phone));
    claim.commit();
  });
  return ensureAccount(proof.phone);
}

/** The live record behind a session cookie. Null when the account was deleted. */
export async function loadAccount(accountId: string): Promise<Account | null> {
  const snap = await adminDb().collection(COL.accounts).doc(accountId).get();
  if (!snap.exists) return null;
  const data = snap.data() as AccountDoc;
  return { id: snap.id, username: data.username, suspended: !!data.suspended };
}

export interface AccountDetail extends Account {
  phone: string;
  createdAt: Date | null;
}

/** Everything the profile page shows about the account itself. */
export async function loadAccountDetail(accountId: string): Promise<AccountDetail | null> {
  const snap = await adminDb().collection(COL.accounts).doc(accountId).get();
  if (!snap.exists) return null;
  const d = snap.data() as AccountDoc;
  return {
    id: snap.id,
    username: d.username,
    suspended: !!d.suspended,
    phone: d.phone,
    createdAt: d.createdAt?.toDate?.() ?? null,
  };
}

/** Which account owns a number, if any. The profile uses this to find your donor listing. */
export async function accountIdForPhone(phoneE164: string): Promise<string | null> {
  const snap = await adminDb().collection(COL.accountPhones).doc(phoneKey(phoneE164)).get();
  return (snap.data()?.accountId as string | undefined) ?? null;
}
