// Preset avatars: a donor picks one of these instead of uploading a photo, so there is nothing to
// store, moderate or leak. Only the id is saved; the glyph and colour live here.
export const AVATARS = [
  { id: "drop", glyph: "🩸", bg: "#fbe3e1" },
  { id: "heart", glyph: "❤️", bg: "#fde2e8" },
  { id: "star", glyph: "⭐", bg: "#fdf1cc" },
  { id: "sun", glyph: "☀️", bg: "#fde8c8" },
  { id: "moon", glyph: "🌙", bg: "#e4e3f7" },
  { id: "leaf", glyph: "🌿", bg: "#dff3df" },
  { id: "wave", glyph: "🌊", bg: "#d9eefa" },
  { id: "flower", glyph: "🌸", bg: "#fbe0f0" },
  { id: "bird", glyph: "🕊️", bg: "#e6edf5" },
  { id: "butterfly", glyph: "🦋", bg: "#dcecfb" },
  { id: "fire", glyph: "🔥", bg: "#fddccc" },
  { id: "hands", glyph: "🤝", bg: "#efe6da" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export function getAvatar(id: unknown) {
  return AVATARS.find((a) => a.id === id);
}

export function isAvatarId(v: unknown): v is AvatarId {
  return getAvatar(v) !== undefined;
}
