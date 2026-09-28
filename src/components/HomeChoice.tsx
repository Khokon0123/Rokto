import Link from "next/link";
import { btnPrimary, btnSecondary, cardClass } from "@/components/styles";
import { t } from "@/i18n";

/**
 * The homepage's job is just this choice - it never runs a search or shows anyone's details on
 * its own. Search lives at /search, reached deliberately, not dumped on screen on arrival.
 */
export default function HomeChoice() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={`${cardClass} flex flex-col gap-4`}>
        <div>
          <h2 className="text-xl font-bold text-ink">{t.home.choice.searchTitle}</h2>
          <p className="mt-1 text-base text-muted">{t.home.choice.searchBody}</p>
        </div>
        <Link href="/search" className={`${btnPrimary} mt-auto w-full`}>
          {t.home.choice.searchCta}
        </Link>
      </div>
      <div className={`${cardClass} flex flex-col gap-4`}>
        <div>
          <h2 className="text-xl font-bold text-ink">{t.home.choice.registerTitle}</h2>
          <p className="mt-1 text-base text-muted">{t.home.choice.registerBody}</p>
        </div>
        <Link href="/register" className={`${btnSecondary} mt-auto w-full`}>
          {t.home.choice.registerCta}
        </Link>
      </div>
    </div>
  );
}
