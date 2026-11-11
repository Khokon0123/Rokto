import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { REVEAL_DEDUP_SECONDS, REVEAL_RETENTION_DAYS } from "@/config/app";
import { adminDb } from "@/lib/firebase/admin";
import type { RevealedDonor } from "./donors";
import { COL } from "./keys";

// reveals/{auto} - the audit trail: who took which donor's number, and when. Append-only and
// server-written; firestore.rules denies every client read and write, and nothing in the app ever
// updates or deletes a row except the retention cleanup.
//
// The donor's name, area and blood group are COPIED in rather than referenced: a donor who edits
// their profile or deletes it must not silently rewrite or blank out the history of who contacted
// them. That history is the donor's protection.

export interface RevealInput {
  seekerId: string;
  username: string;
  donorId: string;
  donor: RevealedDonor;
  ip: string;
  subnet: string;
  userAgent: string;
}

/** True when a row was written; false when this was the same look-up inside the dedup window. */
export async function recordReveal(input: RevealInput): Promise<boolean> {
  const db = adminDb();
  const dedupRef = db.collection(COL.revealDedup).doc(`${input.seekerId}:${input.donorId}`);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const seen = await tx.get(dedupRef);
    const expireAt = seen.data()?.expireAt as Timestamp | undefined;
    // The window is checked here, not inferred from the document being gone: Firestore's TTL
    // sweeper is best-effort and routinely runs hours late.
    if (seen.exists && expireAt && expireAt.toMillis() > now) return false;

    tx.set(dedupRef, { expireAt: Timestamp.fromMillis(now + REVEAL_DEDUP_SECONDS * 1000) });
    tx.set(db.collection(COL.reveals).doc(), {
      seekerId: input.seekerId,
      username: input.username,
      donorId: input.donorId,
      donorNameAtReveal: input.donor.name,
      donorAreaAtReveal: input.donor.area,
      donorGroupAtReveal: input.donor.bloodGroup,
      at: FieldValue.serverTimestamp(),
      ip: input.ip,
      subnet: input.subnet,
      userAgent: input.userAgent.slice(0, 200),
      expireAt: Timestamp.fromMillis(now + REVEAL_RETENTION_DAYS * 86_400_000),
    });
    // merge, not update: an account deleted between the session check and here must not turn a
    // successful reveal into a 500.
    tx.set(
      db.collection(COL.seekers).doc(input.seekerId),
      { revealCount: FieldValue.increment(1), lastActiveAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return true;
  });
}
