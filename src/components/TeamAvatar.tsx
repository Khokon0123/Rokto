import Image from "next/image";

/** Round photo, or the person's initials when no photo was added. */
export default function TeamAvatar({ name, photo, size = 72 }: { name: string; photo: string; size?: number }) {
  const style = { width: size, height: size };
  if (photo) {
    return (
      <Image
        src={photo}
        alt={name}
        width={size}
        height={size}
        style={style}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent-deep"
    >
      {initials}
    </span>
  );
}
