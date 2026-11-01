"use client";

import { useState } from "react";
import BloodBadge from "@/components/BloodBadge";
import { useErrorMessage, useLocale, useT } from "@/components/LocaleProvider";
import { errorTextClass } from "@/components/styles";
import { fmt } from "@/i18n";
import { areaLabel } from "@/lib/areas";
import { formatDate } from "@/lib/donation";
import { formatLocalPhone } from "@/lib/phone";
import { revealDonorPhone } from "@/lib/reveal";
import type { SearchResult } from "@/lib/search";

/**
 * One donor, as a flat row inside the search card. /search keeps its own DonorCard untouched.
 *
 * A row, not a nested card: a bordered card inside a bordered card costs ~32px of width on a
 * 360px phone, which is the difference between a name fitting and being truncated. The parent
 * <ul> draws the 1px dividers.
 *
 * The number gate is deliberately the SAME one /search uses: revealDonorPhone(), the single
 * shared call behind "tap to reveal". In "tap" mode the API sends donor.phone as "", so nothing
 * here can show a number before the visitor asks and the server hands one over. If the site is
 * ever switched to "public" mode the phone arrives filled in and both buttons are live at once,
 * exactly how CallButton already behaves.
 *
 * Deliberately NOT carried over from DonorCard: the "view approximate location" maps link. The
 * homepage is the most-shared surface on the site and donor coordinates do not belong on it.
 */
const action = "inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold";
const outline = `${action} border border-accent bg-surface text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60`;

export default function HomeDonorCard({ result }: { result: SearchResult }) {
  const t = useT();
  const { locale } = useLocale();
  const errorMessage = useErrorMessage();
  const { donor, coolingDown } = result;
  const [phone, setPhone] = useState(donor.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setBusy(true);
    setError(null);
    const res = await revealDonorPhone(donor.id);
    setBusy(false);
    if (res.phone) setPhone(res.phone);
    else setError(res.error ?? "generic");
  }

  return (
    <li className="py-3">
      {/* flex-wrap + w-full/sm:w-auto on the actions: below sm they wrap onto their own full
          width line, from sm up they sit on the same row as the name. One render, no duplicate. */}
      <div className="flex flex-wrap items-center gap-3">
        <BloodBadge group={donor.bloodGroup} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">{donor.name}</p>
          <p className="truncate text-sm text-ink">{areaLabel(donor.area, locale)}</p>
          {/* Only when there is a date: "not given" on most rows was noise, not information. */}
          {donor.lastDonated && (
            <p className="text-xs text-muted">
              {fmt(t.card.lastDonated, { date: formatDate(donor.lastDonated, locale) })}
            </p>
          )}
        </div>

        {phone ? (
          <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
            <a href={`tel:${phone}`} className={`${outline} flex-1 sm:flex-none`}>
              {fmt(t.card.call, { phone: formatLocalPhone(phone) })}
            </a>
            {/* wa.me wants the E.164 digits with no "+". */}
            <a
              href={`https://wa.me/${phone.replace(/^\+/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${action} flex-1 border border-line bg-surface text-ink hover:bg-page sm:flex-none`}
            >
              {t.homeSearch.whatsapp}
            </a>
          </div>
        ) : (
          <button type="button" onClick={reveal} disabled={busy} className={`${outline} w-full sm:w-auto sm:shrink-0`}>
            {busy ? t.card.revealing : t.card.showNumber}
          </button>
        )}
      </div>

      {coolingDown && (
        <p className="mt-2 rounded-xl bg-page px-3 py-2 text-xs font-medium text-muted">{t.card.recent}</p>
      )}
      {error && (
        <p role="alert" className={errorTextClass}>
          {errorMessage(error)}
        </p>
      )}
    </li>
  );
}
