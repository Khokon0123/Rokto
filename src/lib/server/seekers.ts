import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { SEEKER_USERNAME_TRIES } from "@/config/app";
import { adminDb } from "@/lib/firebase/admin";
import { ApiError } from "./http";
import { COL, phoneKey } from "./keys";
import { claimProof, type ProofData } from "./otp";
import { generateUsername } from "./username";

// seekers/{sha256(phone)} - one account per phone number, by construction: the document id IS the
// phone hash, so two simultaneous sign-ins cannot create two accounts. The phone itself is stored
// because accountability is the whole point of this feature: when a donor reports harassment, the
// admin has to be able to say who made the call. /privacy says so in plain words.

export interface Seeker {
  id: string;
  username: string;
  suspended: boolean;
}

interface SeekerDoc {
  username: string;
  phone: string;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  suspended: boolean;
  revealCount: number;
}

/**
 * Signs a verified phone in, creating the account on first use. Returns the SAME username every
 * time for a given number - a seeker who clears their cookies does not get a fresh identity, which
 * is what makes the audit trail worth keeping.
 *
 * The OTP proof is spent in this same transaction (S11), so a replayed proof cannot mint a second
 * account, and a failed write leaves the proof unspent for an honest retry.
 */
export async function signInSeeker(proof: ProofData): Promise<Seeker & { created: boolean }> {
  const db = adminDb();
  const ref = db.collection(COL.seekers).doc(phoneKey(proof.phone));

  return db.runTransaction(async (tx) => {
    // Reads first, every one of them: Firestore forbids a read after a write in a transaction.
    const claim = await claimProof(tx, proof, ref.id);
    const snap = await tx.get(ref);

    if (snap.exists) {
      const data = snap.data() as SeekerDoc;
      claim.commit();
      tx.update(ref, { lastActiveAt: FieldValue.serverTimestamp() });
      return { id: ref.id, username: data.username, suspended: !!data.suspended, created: false };
    }

    let username: string | null = null;
    for (let i = 0; i < SEEKER_USERNAME_TRIES && !username; i++) {
      const candidate = generateUsername();
      const taken = await tx.get(db.collection(COL.seekerUsernames).doc(candidate));
      if (!taken.exists) username = candidate;
    }
    if (!username) throw new ApiError(503, "server_error");

    const now = FieldValue.serverTimestamp();
    claim.commit();
    tx.set(ref, { username, phone: proof.phone, createdAt: now, lastActiveAt: now, suspended: false, revealCount: 0 });
    tx.set(db.collection(COL.seekerUsernames).doc(username), { seekerId: ref.id, at: now });
    return { id: ref.id, username, suspended: false, created: true };
  });
}

/** The live record behind a session cookie. Null when the account was deleted. */
export async function loadSeeker(seekerId: string): Promise<Seeker | null> {
  const snap = await adminDb().collection(COL.seekers).doc(seekerId).get();
  if (!snap.exists) return null;
  const data = snap.data() as SeekerDoc;
  return { id: snap.id, username: data.username, suspended: !!data.suspended };
}
