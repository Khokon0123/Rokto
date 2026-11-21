"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary } from "@/components/styles";

/**
 * The homepage's job is just this choice - it never runs a search or shows anyone's details on
 * its own. Search lives at /search, reached deliberately, not dumped on screen on arrival.
 *
 * Redesign note: the find-a-donor card is the primary one (red top rule, filled button) and the
 * register card is secondary (outline button). Both links go exactly where they always did.
 * The card radius is set here rather than in the shared `cardClass`, so /search and the other
 * pages keep the corners they have today.
 */
const card = "rounded-[18px] border border-line bg-surface p-6 shadow-card";

export default function HomeChoice() {
  const t = useT();
  return (
    // Equal height by default (no items-start), with mt-auto pinning each button to the bottom
    // of its own card. Letting the cards size to their content made the shorter one look
    // clipped beside the taller; stretching without mt-auto left the button floating mid-card.
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={`${card} flex flex-col gap-4 border-t-4 border-t-accent`}>
        <div>
          <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
            {t.home.urgentTag}
          </span>
          <h2 className="mt-3 text-xl font-bold text-ink">{t.home.choice.searchTitle}</h2>
          <p className="mt-1 text-base leading-relaxed text-muted">{t.home.choice.searchBody}</p>
        </div>
        <Link href="/search" className={`${btnPrimary} mt-auto w-full`}>
          {t.home.choice.searchCta}
        </Link>
      </div>

      <div className={`${card} flex flex-col gap-4`}>
        <div>
          <h2 className="text-xl font-bold text-ink">{t.home.choice.registerTitle}</h2>
          <p className="mt-1 text-base leading-relaxed text-muted">{t.home.choice.registerBody}</p>
          <ul className="mt-4 space-y-1.5">
            {t.home.registerPoints.map((point) => (
              <li key={point} className="relative pl-6 text-sm leading-relaxed text-muted">
                <span aria-hidden className="absolute left-0 font-bold text-accent">
                  {"✓"}
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <Link href="/register?donor=1" className={`${btnSecondary} mt-auto w-full`}>
          {t.home.choice.registerCta}
        </Link>
      </div>
    </div>
  );
}
