import type { BloodGroup } from "@/lib/bloodGroups";

/** Large, high-contrast badge. Rh-positive = deep red, Rh-negative = darker maroon. */
export default function BloodBadge({ group, className = "" }: { group: BloodGroup; className?: string }) {
  const negative = group.endsWith("-");
  return (
    <span
      aria-label={`Blood group ${group.replace("+", " positive").replace("-", " negative")}`}
      className={`inline-flex h-16 min-w-16 shrink-0 items-center justify-center rounded-2xl px-3 text-2xl font-extrabold text-white ${
        negative ? "bg-accent-deep" : "bg-accent"
      } ${className}`}
    >
      {group}
    </span>
  );
}
