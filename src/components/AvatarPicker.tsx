"use client";

import Avatar from "@/components/Avatar";
import { useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { AVATARS } from "@/lib/avatars";
import { labelClass, labelOnRed } from "./styles";

/** Pick one preset avatar, or none. One scrolling row; tapping the chosen one again clears it. */
export default function AvatarPicker({
  value,
  onChange,
  onDark = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  /** White text and ring, for use straight on the red page. */
  onDark?: boolean;
}) {
  const t = useT();
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className={onDark ? labelOnRed : labelClass}>{t.avatar.label}</legend>
      <p className={`mb-3 text-sm ${onDark ? "text-white/85" : "text-muted"}`}>{t.avatar.hint}</p>
      {/* Bleeds to the screen edge so a half-visible avatar says "scroll". */}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 py-1">
        {AVATARS.map((a, i) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={value === a.id}
            aria-label={fmt(t.avatar.option, { n: i + 1 })}
            onClick={() => onChange(value === a.id ? null : a.id)}
            className={`shrink-0 rounded-full ${
              value === a.id ? `ring-4 ${onDark ? "ring-white" : "ring-accent"}` : "opacity-80 hover:opacity-100"
            }`}
          >
            <Avatar id={a.id} size={52} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
