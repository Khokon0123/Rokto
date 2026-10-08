import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_TEAM } from "@/config/app";
import { TEAM_SECTIONS, type TeamMember, type TeamMemberInput, type TeamSection } from "@/lib/team";
import { ApiError } from "./http";

// team/{id}       PRIVATE in Firestore rules. Read by /team and the admin panel through the Admin SDK.
// meta/team       { seeded: true } once DEFAULT_TEAM has been copied in, so deleting everyone
//                 from the admin panel doesn't bring the defaults back.
const TEAM = "team";
const META = "meta";

function toMember(id: string, d: FirebaseFirestore.DocumentData): TeamMember {
  return {
    id,
    name: String(d.name ?? ""),
    role: String(d.role ?? ""),
    section: TEAM_SECTIONS.includes(d.section) ? (d.section as TeamSection) : "founding",
    photo: String(d.photo ?? ""),
    email: String(d.email ?? ""),
    facebook: String(d.facebook ?? ""),
    order: typeof d.order === "number" ? d.order : 0,
  };
}

/** First run only: copy the hard-coded starting team into Firestore. */
async function seedIfNeeded(): Promise<void> {
  const db = adminDb();
  const metaRef = db.collection(META).doc(TEAM);
  await db.runTransaction(async (tx) => {
    const meta = await tx.get(metaRef);
    if (meta.exists && meta.data()?.seeded) return;
    DEFAULT_TEAM.forEach((m, i) => {
      tx.set(db.collection(TEAM).doc(), { ...m, order: i, createdAt: FieldValue.serverTimestamp() });
    });
    tx.set(metaRef, { seeded: true });
  });
}

/** Everyone, in display order. */
export async function listTeam(): Promise<TeamMember[]> {
  await seedIfNeeded();
  const snap = await adminDb().collection(TEAM).orderBy("order").get();
  return snap.docs.map((doc) => toMember(doc.id, doc.data()));
}

export async function createTeamMember(fields: TeamMemberInput): Promise<TeamMember> {
  const db = adminDb();
  const last = await db.collection(TEAM).orderBy("order", "desc").limit(1).get();
  const order = last.empty ? 0 : (last.docs[0].data().order ?? 0) + 1;
  const ref = await db.collection(TEAM).add({ ...fields, order, createdAt: FieldValue.serverTimestamp() });
  return { id: ref.id, ...fields, order };
}

export async function updateTeamMember(id: string, fields: TeamMemberInput): Promise<void> {
  const ref = adminDb().collection(TEAM).doc(id);
  if (!(await ref.get()).exists) throw new ApiError(404, "bad_request");
  await ref.update({ ...fields, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteTeamMember(id: string): Promise<void> {
  await adminDb().collection(TEAM).doc(id).delete();
}

/** Swaps a member with their neighbour in the same section, then renumbers everyone 0..n. */
export async function moveTeamMember(id: string, direction: "up" | "down"): Promise<void> {
  const db = adminDb();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.collection(TEAM).orderBy("order"));
    const all = snap.docs.map((d) => toMember(d.id, d.data()));
    const i = all.findIndex((m) => m.id === id);
    if (i === -1) throw new ApiError(404, "bad_request");
    const step = direction === "up" ? -1 : 1;
    let j = i + step;
    while (j >= 0 && j < all.length && all[j].section !== all[i].section) j += step;
    if (j < 0 || j >= all.length) return; // already first/last in its section
    [all[i], all[j]] = [all[j], all[i]];
    all.forEach((m, k) => {
      if (m.order !== k) tx.update(db.collection(TEAM).doc(m.id), { order: k });
    });
  });
}
