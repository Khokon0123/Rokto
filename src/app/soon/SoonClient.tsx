"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary, cardClass } from "@/components/styles";
import { fmt } from "@/i18n";

// Same shape as /team and /register: the headline sits in the red band (SiteHeader keys off the
// pathname), so the content starts with a negative margin and rides over the band's bottom edge.
export default function SoonClient({ daysLeft }: { daysLeft: number }) {
  const t = useT();

  return (
    <div className="relative -mt-14 space-y-5">
      <section className={`${cardClass} space-y-4`}>
        <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-bold text-accent-dark">
          {daysLeft > 0 ? fmt(t.soon.daysLeft, { days: daysLeft }) : t.soon.today}
        </p>
        <p className="text-base leading-relaxed text-ink">{t.soon.lede}</p>
        <ul className="space-y-3">
          {t.soon.points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-base text-ink">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
              {point}
            </li>
          ))}
        </ul>
      </section>

      {/* The point of a pre-launch page: a donor who signs up now is findable on the first day. */}
      <section className={`${cardClass} space-y-3`}>
        <h2 className="text-xl font-extrabold text-ink">{t.soon.donorTitle}</h2>
        <p className="text-base leading-relaxed text-ink">{t.soon.donorBody}</p>
        <Link href="/register?donor=1" className={`${btnPrimary} w-full`}>
          {t.soon.donorCta}
        </Link>
      </section>

      {/* Rokto is already live, so don't pretend otherwise: anyone who needs it today gets a door. */}
      <section className={`${cardClass} space-y-3`}>
        <p className="text-sm leading-relaxed text-muted">{t.soon.liveNote}</p>
        <Link href="/" className={`${btnSecondary} w-full`}>
          {t.soon.liveCta}
        </Link>
      </section>
    </div>
  );
}
