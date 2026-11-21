import { getAvatar } from "@/lib/avatars";

/** A donor's chosen avatar as a round badge. Renders nothing when none is chosen or the id is unknown. */
export default function Avatar({ id, size = 36 }: { id?: string | null; size?: number }) {
  const avatar = getAvatar(id);
  if (!avatar) return null;
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: avatar.bg, fontSize: size * 0.55 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full leading-none"
    >
      {avatar.glyph}
    </span>
  );
}
