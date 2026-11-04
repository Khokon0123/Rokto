"use client";

import { useLocale, useT } from "@/components/LocaleProvider";
import { formatNumber } from "@/i18n/locale";
import type { HeroStatsData } from "@/lib/server/stats";

// flex-1 + min-w-0 on phones: the tiles split the row evenly and may shrink, so the pair always
// fits a 360px screen. From sm up they stop stretching and sit at their natural width.
const tile =
  "min-w-0 flex-1 rounded-2xl border border-white/[0.18] bg-white/10 px-4 py-[14px] backdrop-blur-sm sm:min-w-[140px] sm:flex-none sm:px-[18px]";
const figure = "text-[28px] font-extrabold leading-none text-white";
// truncate, not wrap: a second line would make one tile taller than the other. The labels are
// short enough to fit at 360px in both languages; this is the backstop, not the plan.
const caption = "mt-1.5 truncate text-sm leading-snug text-white/[0.88]";

export default function HeroStats({ available, visits }: HeroStatsData) {
  const t = useT();
  const { locale } = useLocale();

  // Each tile earns its place on its own. One available donor is worth saying; zero is not.
  const showVisits = visits > 0;
  const showAvailable = available > 0;
  if (!showVisits && !showAvailable) return null;

  return (
    <div className="flex w-full gap-3 sm:w-auto">
      {showVisits && (
        <div className={tile}>
          <div className={figure}>{formatNumber(visits, locale)}</div>
          <div className={caption}>{t.home.stats.visitors}</div>
        </div>
      )}
      {showAvailable && (
        <div className={tile}>
          <div className={`${figure} flex items-center gap-2`}>
            {/* Decorative: the label already says these donors are ready, so the dot is hidden
                from screen readers rather than read out as an unexplained bullet. */}
            <span className="rokto-pulse-dot" aria-hidden="true" />
            {formatNumber(available, locale)}
          </div>
          <div className={caption}>{t.home.stats.available}</div>
        </div>
      )}
    </div>
  );
}
