"use client";

import { useLocale, useT } from "@/components/LocaleProvider";
import { formatNumber } from "@/i18n/locale";
import type { HeroStatsData } from "@/lib/server/stats";

// flex-1 + min-w-0 on phones: the two tiles split the row evenly and may shrink, so the pair
// always fits a 360px screen. From sm up they stop stretching and sit at their natural width.
const tile =
  "min-w-0 flex-1 rounded-2xl border border-white/[0.18] bg-white/10 px-4 py-[14px] backdrop-blur-sm sm:min-w-[140px] sm:flex-none sm:px-[18px]";
const figure = "text-[28px] font-extrabold leading-none text-white";
// truncate, not wrap: a second line would make one tile taller than the other and, when the
// tiles sat in a fixed-height band, pushed them out the bottom of it. The labels are short
// enough to fit at 360px in both languages - this is the backstop, not the plan.
const caption = "mt-1.5 truncate text-sm leading-snug text-white/[0.88]";

export default function HeroStats({ registered, available }: HeroStatsData) {
  const t = useT();
  const { locale } = useLocale();

  // Floored to the nearest ten so the headline figure never looks precision-engineered, and
  // never ticks down in public if a donor deletes their profile between two page loads.
  const rounded = Math.floor(registered / 10) * 10;

  return (
    <div className="flex w-full gap-3 sm:w-auto">
      <div className={tile}>
        <div className={figure}>
          {formatNumber(rounded, locale)}
          <span aria-hidden="true">+</span>
        </div>
        <div className={caption}>{t.home.stats.registered}</div>
      </div>
      <div className={tile}>
        <div className={`${figure} flex items-center gap-2`}>
          {/* Decorative: the label already says these donors are ready, so the dot is hidden
              from screen readers rather than read out as an unexplained bullet. */}
          <span className="rokto-pulse-dot" aria-hidden="true" />
          {formatNumber(available, locale)}
        </div>
        <div className={caption}>{t.home.stats.available}</div>
      </div>
    </div>
  );
}
