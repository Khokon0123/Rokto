"use client";

import { useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import type { BloodGroup } from "@/lib/bloodGroups";

/** Large, high-contrast badge. Rh-positive = deep red, Rh-negative = darker maroon. */
export default function BloodBadge({ group, className = "" }: { group: BloodGroup; className?: string }) {
  const t = useT();
  const negative = group.endsWith("-");
  // E4: "Blood group A positive" / "রক্তের গ্রুপ A পজিটিভ"
  const spoken = `${group.slice(0, -1)} ${negative ? t.badge.negative : t.badge.positive}`;
  return (
    <span
      role="img"
      aria-label={fmt(t.badge.label, { group: spoken })}
      className={`inline-flex h-16 min-w-16 shrink-0 items-center justify-center rounded-2xl px-3 text-2xl font-extrabold text-white ${
        negative ? "bg-accent-deep" : "bg-accent"
      } ${className}`}
    >
      {group}
    </span>
  );
}
