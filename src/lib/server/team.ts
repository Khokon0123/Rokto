import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { unstable_cache, revalidatePath, revalidateTag } from "next/cache";
import { DEFAULT_TEAM } from "@/config/app";
import { adminDb } from "@/lib/firebase/admin";
import { sha256 } from "./keys";
import { isServedPhoto, TEAM_SECTIONS, type TeamMember, type TeamMemberInput, type TeamSection } from "@/lib/team";
import { ApiError } from "./http";

// team/{id}   PRIVATE in Firestore rules. Read by /team and the admin panel through the Admin SDK.
// meta/team   { seeded: true } once DEFAULT_TEAM has been copied in (an explicit admin action, D7).
const TEAM = "team";
const META = "meta";
const TAG = "team";

/** Uploaded photos (data URLs) are served from /api/team/:id/photo instead of being inlined
 *  into every /team page and RSC payload (H8). `v` busts the browser cache when it changes. */
function publicPhoto(id: string, photo: string): string {
  if (!photo.startsWith("data:")) return photo;
  return `/api/team/${id}/photo?v=${sha256(photo).slice(0, 10)}`;
}

function toMember(id: string, d: FirebaseFirestore.DocumentData): TeamMember {
  return {
    id,
    name: String(d.name ?? ""),
    role: String(d.role ?? ""),
    section: TEAM_SECTIONS.includes(d.section) ? (d.section as TeamSection) : "founding",
    photo: publicPhoto(id, String(d.photo ?? "")),
    email: String(d.email ?? ""),
    facebook: String(d.facebook ?? ""),
    order: typeof d.order === "number" ? d.order : 0,
  };
}

async function readTeam(): Promise<TeamMember[]> {
  const snap = await adminDb().collection(TEAM).orderBy("order").get();
  return snap.docs.map((doc) => toMember(doc.id, doc.data()));
}

/** Everyone, in display order. Cached for /team; the admin panel reads fresh. */
export const listTeamCached = unstable_cache(readTeam, ["team-v1"], { revalidate: 300, tags: [TAG] });
export const listTeam = readTeam;

/** Whether the starting team was ever copied in, so the admin panel can offer to do it. */
export async function isTeamSeeded(): Promise<boolean> {
  const meta = await adminDb().collection(META).doc(TEAM).get();
  return Boolean(meta.data()?.seeded);
}

/** D7: seeding is an explicit admin action now, never a side effect of a public page view. */
export async function seedTeam(): Promise<boolean> {
  const db = adminDb();
  const metaRef = db.collection(META).doc(TEAM);
  const seeded = await db.runTransaction(async (tx) => {
    const meta = await tx.get(metaRef);
    if (meta.data()?.seeded) return false;
    DEFAULT_TEAM.forEach((m, i) => {
      tx.set(db.collection(TEAM).doc(), { ...m, order: i, createdAt: FieldValue.serverTimestamp() });
    });
    tx.set(metaRef, { seeded: true });
    return true;
  });
  refreshTeamPage();
  return seeded;
}

function refreshTeamPage(): void {
  try {
    revalidateTag(TAG, { expire: 0 });
    revalidatePath("/team");
  } catch {
    /* outside a request (scripts/tests) */
  }
}

/** The raw stored photo (a data URL or /public path) for the photo route. */
export async function getStoredPhoto(id: string): Promise<string | null> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) return null;
  const snap = await adminDb().collection(TEAM).doc(id).get();
  const photo = snap.data()?.photo;
  return typeof photo === "string" && photo ? photo : null;
}

/** D7: `order = max + 1` inside a transaction, so two simultaneous adds can't share a slot. */
export async function createTeamMember(fields: TeamMemberInput): Promise<TeamMember> {
  const db = adminDb();
  const ref = db.collection(TEAM).doc();
  const order = await db.runTransaction(async (tx) => {
    const last = await tx.get(db.collection(TEAM).orderBy("order", "desc").limit(1));
    const next = last.empty ? 0 : (last.docs[0].data().order ?? 0) + 1;
    tx.set(ref, { ...fields, photo: isServedPhoto(fields.photo) ? "" : fields.photo, order: next, createdAt: FieldValue.serverTimestamp() });
    return next;
  });
  refreshTeamPage();
  return toMember(ref.id, { ...fields, order });
}

export async function updateTeamMember(id: string, fields: TeamMemberInput): Promise<void> {
  const ref = adminDb().collection(TEAM).doc(id);
  if (!(await ref.get()).exists) throw new ApiError(404, "not_found");
  // A served URL means "photo unchanged": keep what's stored instead of overwriting it with the URL.
  const { photo, ...rest } = fields;
  const update = isServedPhoto(photo) ? rest : fields;
  await ref.update({ ...update, updatedAt: FieldValue.serverTimestamp() });
  refreshTeamPage();
}

export async function deleteTeamMember(id: string): Promise<void> {
  await adminDb().collection(TEAM).doc(id).delete();
  refreshTeamPage();
}

/** Swaps a member with their neighbour in the same section, then renumbers everyone 0..n. */
export async function moveTeamMember(id: string, direction: "up" | "down"): Promise<void> {
  const db = adminDb();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.collection(TEAM).orderBy("order"));
    const all = snap.docs.map((d) => toMember(d.id, d.data()));
    const i = all.findIndex((m) => m.id === id);
    if (i === -1) throw new ApiError(404, "not_found");
    const step = direction === "up" ? -1 : 1;
    let j = i + step;
    while (j >= 0 && j < all.length && all[j].section !== all[i].section) j += step;
    if (j < 0 || j >= all.length) return; // already first/last in its section
    [all[i], all[j]] = [all[j], all[i]];
    all.forEach((m, k) => {
      if (m.order !== k) tx.update(db.collection(TEAM).doc(m.id), { order: k });
    });
  });
  refreshTeamPage();
}
