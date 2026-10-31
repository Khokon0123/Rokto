"use client";

import { useLocale, useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { areaLabel } from "@/lib/areas";
import { formatDate } from "@/lib/donation";
import { formatDistanceKm } from "@/lib/geo";
import type { SearchResult } from "@/lib/search";
import BloodBadge from "./BloodBadge";
import CallButton from "./CallButton";
import ReportListing from "./ReportListing";
import { btnPrimary, btnSecondary, cardClass } from "./styles";

/** `stale`: these results belong to the previous filters and a new search is loading (F1). */
export default function DonorCard({ result, stale = false }: { result: SearchResult; stale?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const { donor, coolingDown, distanceKm } = result;

  return (
    <li className={cardClass}>
      <div className="flex items-center gap-4">
        <BloodBadge group={donor.bloodGroup} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-ink">{donor.name}</p>
          <p className="text-base text-ink">
            {areaLabel(donor.area, locale)}
            {typeof distanceKm === "number" && distanceKm !== Infinity && (
              <span className="text-muted">
                {" "}
                {"·"} {fmt(t.card.distanceAway, { distance: formatDistanceKm(distanceKm, locale) })}
              </span>
            )}
          </p>
          <p className="text-sm text-muted">
            {donor.lastDonated
              ? fmt(t.card.lastDonated, { date: formatDate(donor.lastDonated, locale) })
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
      <div className="mt-4">
        <CallButton
          donorId={donor.id}
          phone={donor.phone}
          disabled={stale}
          className={`${coolingDown ? btnSecondary : btnPrimary} min-h-16 w-full text-lg font-bold`}
        />
      </div>
      {!stale && <ReportListing donorId={donor.id} />}
    </li>
  );
}
