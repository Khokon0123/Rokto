"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";

/**
 * Two quiet, secondary sections shown under the search on the homepage only.
 * Deliberately small and muted so the search card stays the primary focus.
 */
export default function HomeInfo() {
  const t = useT();
  const [register, ...others] = t.home.helpItems;

  return (
    <div className="mt-12 space-y-10">
      <section aria-labelledby="why-rokto" className="border-l-2 border-accent/60 pl-4">
        <h2 id="why-rokto" className="text-sm font-semibold text-ink">
          {t.home.whyTitle}
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{t.home.whyBody}</p>
      </section>

      <section aria-labelledby="how-to-help">
        <h2 id="how-to-help" className="text-sm font-semibold text-ink">
          {t.home.helpTitle}
        </h2>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          <li className="px-5 py-4">
            <Link href="/register" className="text-sm font-semibold text-accent underline underline-offset-2">
              {register.title}
            </Link>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">{register.body}</p>
          </li>
          {others.map((item) => (
            <li key={item.title} className="px-5 py-4">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* L3: what Rokto is (and isn't). The eligibility text itself is for the owner and a medical
          advisor to write; until then it shows as a marked placeholder. */}
      <section aria-labelledby="before-donating" className="border-l-2 border-accent/60 pl-4">
        <h2 id="before-donating" className="text-sm font-semibold text-ink">
          {t.eligibility.title}
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{t.eligibility.disclaimer}</p>
        <h3 className="mt-3 text-sm font-semibold text-ink">{t.eligibility.whoTitle}</h3>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{t.eligibility.whoBody}</p>
      </section>

      {/* Donors who lost their edit link used to have to find a grey link at the bottom of
          /search to get a new one. Most never did, so their details went stale instead. */}
      <section aria-labelledby="already-registered" className="border-l-2 border-accent/60 pl-4">
        <h2 id="already-registered" className="text-sm font-semibold text-ink">
          {t.home.registeredTitle}
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{t.home.registeredBody}</p>
        <Link
          href="/recover"
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-2"
        >
          {t.home.registeredCta}
        </Link>
      </section>
    </div>
  );
}
