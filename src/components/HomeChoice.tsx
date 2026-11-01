"use client";

import Link from "next/link";
import { Suspense } from "react";
import HomeSearch from "@/components/HomeSearch";
import { useT } from "@/components/LocaleProvider";
import { btnSecondary } from "@/components/styles";

/**
 * The find card carries the search itself: pick a blood group, optionally narrow by area, and
 * the matching donors appear in place. Nobody's details load until a group is chosen, and phone
 * numbers stay behind the same tap-to-reveal gate /search uses. The full filter set (compatible
 * groups, map, distance) still lives at /search, one link away.
 *
 * Stacked, not side by side: with results in it the search card runs far taller than the
 * register card ever will, and a two-column grid left a tall empty white column beside it.
 * Register is a slim banner underneath instead, where it stays visible without competing.
 *
 * The card radius is set here rather than in the shared `cardClass`, so /search and the other
 * pages keep the corners they have today.
 */
const card = "rounded-[18px] border border-line bg-surface shadow-card";

export default function HomeChoice() {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className={`${card} flex min-w-0 flex-col gap-4 border-t-4 border-t-accent p-6`}>
        <div>
          <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
            {t.home.urgentTag}
          </span>
          <h2 className="mt-3 text-xl font-bold text-ink">{t.home.choice.searchTitle}</h2>
          <p className="mt-1 text-base leading-relaxed text-muted">{t.home.choice.searchBody}</p>
        </div>
        {/* useSearchParams needs a Suspense boundary above it; the fallback is the quiet
            pre-selection state the search shows anyway, so nothing visibly flashes. */}
        <Suspense fallback={<p className="text-sm text-muted">{t.homeSearch.pickGroup}</p>}>
          <HomeSearch />
        </Suspense>
      </div>

      <div className={`${card} flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">{t.home.choice.registerTitle}</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-muted">{t.home.choice.registerBody}</p>
        </div>
        <Link href="/register" className={`${btnSecondary} shrink-0 sm:w-auto`}>
          {t.home.choice.registerCta}
        </Link>
      </div>
    </div>
  );
}
