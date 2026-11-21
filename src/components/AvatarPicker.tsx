"use client";

import Avatar from "@/components/Avatar";
import { useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { AVATARS } from "@/lib/avatars";
import { labelClass } from "./styles";

/** Pick one preset avatar, or none. Tapping the chosen one again clears it. */
export default function AvatarPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const t = useT();
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className={labelClass}>{t.avatar.label}</legend>
      <p className="mb-3 text-sm text-muted">{t.avatar.hint}</p>
      <div className="grid grid-cols-6 gap-2">
        {AVATARS.map((a, i) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={value === a.id}
            aria-label={fmt(t.avatar.option, { n: i + 1 })}
            onClick={() => onChange(value === a.id ? null : a.id)}
            className={`flex min-h-12 items-center justify-center rounded-2xl border-2 ${
              value === a.id ? "border-accent bg-accent-soft" : "border-line bg-surface"
            }`}
          >
            <Avatar id={a.id} size={34} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
