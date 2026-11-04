import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { COL } from "./keys";

// A single counter document, meta/stats, holding how many visits the homepage has recorded.
// It counts nothing about who visited: no address, no device, no identifier, just +1. The
// dedup cookie set by /api/visit carries no value of its own either.
//
// Read honestly: this number is a floor made of browser sessions, not people. A visitor who
// clears cookies counts twice, and a crawler that fakes a human user agent counts at all. For
// a figure to make decisions from, read Vercel Analytics instead; this one is for the page.

const DOC = "stats";

/** +1, created on first use. Never reads, so it costs one write and cannot race. */
export async function recordVisit(): Promise<void> {
  await adminDb().collection(COL.meta).doc(DOC).set({ visits: FieldValue.increment(1) }, { merge: true });
}

const readVisits = async (): Promise<number> => {
  const snap = await adminDb().collection(COL.meta).doc(DOC).get();
  const n = snap.data()?.visits;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

/**
 * Cached for a minute: the tile should feel alive without costing a Firestore read per visitor.
 * Deliberately NOT invalidated on write - a counter that lags sixty seconds is fine, and
 * busting the cache on every visit would turn one read a minute into one read a visit.
 */
export const loadVisits = unstable_cache(readVisits, ["site-visits-v1"], { revalidate: 60 });
