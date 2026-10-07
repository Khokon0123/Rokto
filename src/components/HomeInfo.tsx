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
    </div>
  );
}
