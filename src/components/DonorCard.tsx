"use client";

import { useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { getArea } from "@/lib/areas";
import { formatDate } from "@/lib/donation";
import { formatDistanceKm } from "@/lib/geo";
import { formatLocalPhone } from "@/lib/phone";
import type { SearchResult } from "@/lib/search";
import BloodBadge from "./BloodBadge";
import { btnPrimary, btnSecondary, cardClass } from "./styles";

export default function DonorCard({ result }: { result: SearchResult }) {
  const t = useT();
  const { donor, coolingDown, distanceKm } = result;
  const areaLabel = getArea(donor.area)?.label ?? donor.area;

  return (
    <li className={cardClass}>
      <div className="flex items-center gap-4">
        <BloodBadge group={donor.bloodGroup} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-ink">{donor.name}</p>
          <p className="text-base text-ink">
            {areaLabel}
            {typeof distanceKm === "number" && distanceKm !== Infinity && (
              <span className="text-muted">
                {" "}
                {"·"} {fmt(t.card.distanceAway, { distance: formatDistanceKm(distanceKm) })}
              </span>
            )}
          </p>
          <p className="text-sm text-muted">
            {donor.lastDonated
              ? fmt(t.card.lastDonated, { date: formatDate(donor.lastDonated) })
              : t.card.lastDonatedNone}
          </p>
          {donor.location && (
            <a
              href={`https://www.google.com/maps?q=${donor.location.lat},${donor.location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-accent underline"
            >
              {t.card.viewLocation} {"↗"}
            </a>
          )}
        </div>
      </div>
      {coolingDown && (
        <p className="mt-3 rounded-xl bg-page px-3 py-2 text-sm font-medium text-muted">{t.card.recent}</p>
      )}
      <a
        href={`tel:${donor.phone}`}
        className={`${coolingDown ? btnSecondary : btnPrimary} mt-4 min-h-16 w-full text-lg font-bold`}
      >
        {fmt(t.card.call, { phone: formatLocalPhone(donor.phone) })}
      </a>
    </li>
  );
}
