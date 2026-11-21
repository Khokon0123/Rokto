"use client";

import { useLocale, useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { areaLabel } from "@/lib/areas";
import { formatDate } from "@/lib/donation";
import { formatDistanceKm } from "@/lib/geo";
import type { SearchResult } from "@/lib/search";
import Avatar from "./Avatar";
import BloodBadge from "./BloodBadge";
import CallButton from "./CallButton";
import ReportListing from "./ReportListing";

/**
 * One donor, as a flat row. The parent <ul> draws the 1px dividers and holds the border: a
 * bordered card inside a bordered list costs about 32px of width on a 360px phone, which is the
 * difference between a name fitting and being truncated.
 *
 * `stale`: these results belong to the previous filters and a new search is loading (F1).
 */
export default function DonorCard({ result, stale = false }: { result: SearchResult; stale?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const { donor, coolingDown, distanceKm } = result;

  return (
    <li className="py-4">
      {/* flex-wrap plus w-full/sm:w-auto on the action: below sm it wraps onto its own full-width
          line, from sm up it sits on the same row as the name. One render, no duplicate button. */}
      <div className="flex flex-wrap items-center gap-3">
        <BloodBadge group={donor.bloodGroup} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-base font-bold text-ink">
            <Avatar id={donor.avatar} size={28} />
            <span className="truncate">{donor.name}</span>
          </p>
          <p className="truncate text-sm text-ink">
            {areaLabel(donor.area, locale)}
            {typeof distanceKm === "number" && Number.isFinite(distanceKm) && (
              <span className="text-muted">
                {" "}
                {"·"} {fmt(t.card.distanceAway, { distance: formatDistanceKm(distanceKm, locale) })}
              </span>
            )}
          </p>
          {/* Only when there is a date: "not given" on most rows was noise, not information. */}
          {donor.lastDonated && (
            <p className="text-xs text-muted">
              {fmt(t.card.lastDonated, { date: formatDate(donor.lastDonated, locale) })}
            </p>
          )}
        </div>
        <CallButton
          donorId={donor.id}
          phone={donor.phone}
          disabled={stale}
          className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-xl border border-accent bg-surface px-4 text-sm font-bold text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        />
      </div>

      {coolingDown && (
        <p className="mt-2 rounded-xl bg-page px-3 py-2 text-xs font-medium text-muted">{t.card.recent}</p>
      )}
      {!stale && <ReportListing donorId={donor.id} />}
    </li>
  );
}
