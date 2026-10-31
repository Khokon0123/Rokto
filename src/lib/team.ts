// Team members shown on /team and managed from the admin panel's Team tab.
// Shared by the browser and the server, so it must not import anything server-only.

export const TEAM_SECTIONS = ["founding", "operations"] as const;
export type TeamSection = (typeof TEAM_SECTIONS)[number];

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  section: TeamSection;
  /** A /public path (e.g. "/team/khokon.jpg"), or for uploads the /api/team/:id/photo URL that serves
   *  it (the stored value is a small JPEG data URL). Empty = initials. */
  photo: string;
  email: string;
  facebook: string;
  order: number;
}

export type TeamMemberInput = Omit<TeamMember, "id" | "order">;

/** Uploaded photos are resized in the browser to this square size before upload. */
export const TEAM_PHOTO_SIZE = 256;
/** Hard cap on a stored photo (a 256px JPEG is ~20-40 KB; this leaves plenty of room). */
export const TEAM_PHOTO_MAX_CHARS = 300_000;
/** Request body cap for team add/edit (photo + fields), see S10. */
export const TEAM_BODY_LIMIT = 400 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_PHOTO_RE = /^\/team\/[\w.-]+\.(jpe?g|png|webp)$/i;
const DATA_PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const SERVED_PHOTO_RE = /^\/api\/team\/[A-Za-z0-9]{1,40}\/photo(\?v=[a-f0-9]{1,16})?$/;

/** An already-uploaded photo, as the server hands it out. Sent back unchanged = "keep the photo". */
export function isServedPhoto(photo: string): boolean {
  return SERVED_PHOTO_RE.test(photo);
}

export function isFacebookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com" || host.endsWith(".fb.com"))
    );
  } catch {
    return false;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Validates an add/edit form. Returns the cleaned fields, or an error code from t.errors. */
export function validateTeamMember(body: Record<string, unknown>): { fields: TeamMemberInput } | { error: string } {
  const name = str(body.name);
  const role = str(body.role);
  const section = str(body.section) as TeamSection;
  const photo = str(body.photo);
  const email = str(body.email).toLowerCase();
  const facebook = str(body.facebook);

  if (name.length < 2 || name.length > 80) return { error: "team_name_invalid" };
  if (role.length < 2 || role.length > 80) return { error: "team_role_invalid" };
  if (!TEAM_SECTIONS.includes(section)) return { error: "bad_request" };
  if (photo && !(PUBLIC_PHOTO_RE.test(photo) || isServedPhoto(photo) || (DATA_PHOTO_RE.test(photo) && photo.length <= TEAM_PHOTO_MAX_CHARS))) {
    return { error: "team_photo_invalid" };
  }
  if (email && (email.length > 120 || !EMAIL_RE.test(email))) return { error: "team_email_invalid" };
  if (facebook && (facebook.length > 300 || !isFacebookUrl(facebook))) return { error: "team_facebook_invalid" };

  return { fields: { name, role, section, photo, email, facebook } };
}
