"use client";

import Image from "next/image";
import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import { ORGS } from "@/config/app";

/** Section radius matches the action cards; the shared `cardClass` is left alone for other pages. */
const panel = "rounded-[18px] border border-line bg-surface p-6";
const eyebrow = "text-xs font-bold uppercase tracking-[0.08em] text-accent";

export default function HomeInfo() {
  const t = useT();
  const help = t.home.helpItems;

  return (
    <div className="mt-16 space-y-16">
      {/* Why Rokto, with the before/after pair from the design */}
      <section aria-labelledby="why-rokto" className="grid gap-6 md:grid-cols-2 md:items-center">
        <div>
          <p className={eyebrow}>{t.home.whyTitle}</p>
          <h2 id="why-rokto" className="mt-2 text-2xl font-bold leading-snug text-ink">
            {t.home.whyHeading}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted">{t.home.whyBody}</p>
        </div>
        <div className="grid gap-3">
          <div className="rounded-[14px] border border-dashed border-line bg-surface p-4">
            <p className="text-sm font-semibold text-muted">{t.home.beforeLabel}</p>
            <p className="mt-1 text-base leading-relaxed text-muted">{t.home.beforeBody}</p>
          </div>
          <div className="rounded-[14px] bg-accent p-4 text-white shadow-card">
            <p className="text-sm font-semibold text-white/85">{t.home.afterLabel}</p>
            <p className="mt-1 text-base leading-relaxed">{t.home.afterBody}</p>
          </div>
        </div>
      </section>

      {/* Three numbered ways to help */}
      <section aria-labelledby="how-to-help">
        <p className={eyebrow}>{t.home.helpEyebrow}</p>
        <h2 id="how-to-help" className="mt-2 text-2xl font-bold text-ink">
          {t.home.helpTitle}
        </h2>
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {help.map((item, i) => (
            <li key={item.title} className={panel}>
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-base font-extrabold text-accent"
              >
                {i + 1}
              </span>
              {i === 0 ? (
                <Link
                  href="/register"
                  className="mt-3 block text-lg font-bold text-accent underline underline-offset-2"
                >
                  {item.title}
                </Link>
              ) : (
                <h3 className="mt-3 text-lg font-bold text-ink">{item.title}</h3>
              )}
              <p className="mt-1 text-base leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Safety, as two cards side by side */}
      <section aria-labelledby="before-donating">
        <p className={eyebrow}>{t.eligibility.eyebrow}</p>
        <h2 id="before-donating" className="mt-2 text-2xl font-bold text-ink">
          {t.eligibility.sectionTitle}
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className={panel}>
            <h3 className="text-lg font-bold text-ink">{t.eligibility.connectTitle}</h3>
            <p className="mt-1 text-base leading-relaxed text-muted">{t.eligibility.disclaimer}</p>
          </div>
          <div className={panel}>
            <h3 className="text-lg font-bold text-ink">{t.eligibility.noneFoundTitle}</h3>
            <p className="mt-1 text-base leading-relaxed text-muted">{t.eligibility.noneFoundBody}</p>
          </div>
        </div>
        {/* Hidden until the owner and a medical advisor approve the eligibility wording (audit L3).
            Kept here, not deleted, so it can be switched back on in one edit.
        <h3 className="mt-4 text-lg font-bold text-ink">{t.eligibility.whoTitle}</h3>
        <p className="mt-1 text-base leading-relaxed text-muted">{t.eligibility.whoBody}</p>
        */}
      </section>

      {/* Partner credits, above the recover card. The site footer still credits them on every
          other page; this is the homepage's own, larger treatment. */}
      <section aria-labelledby="run-by" className="text-center">
        <p className={eyebrow} id="run-by">
          {t.footer.poweredBy.replace("{org}", "").replace(/[:：]\s*$/, "").trim()}
        </p>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {ORGS.map((org) => (
            <li key={org.name}>
              <a
                href={org.url ?? undefined}
                target={org.url ? "_blank" : undefined}
                rel={org.url ? "noopener noreferrer" : undefined}
                className="flex min-h-14 items-center gap-3 rounded-[14px] border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink hover:border-accent"
              >
                {org.logo && (
                  <Image src={org.logo} alt="" width={72} height={72} className="h-9 w-9 rounded-full" />
                )}
                <span>{org.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Donors who lost their edit link used to have to find a grey link at the bottom of
          /search to get a new one. Most never did, so their details went stale instead. */}
      <section aria-labelledby="already-registered" className={`${panel} sm:flex sm:items-center sm:gap-6`}>
        <div className="sm:flex-1">
          <h2 id="already-registered" className="text-lg font-bold text-ink">
            {t.home.registeredTitle}
          </h2>
          <p className="mt-1 text-base leading-relaxed text-muted">{t.home.registeredBody}</p>
        </div>
        <Link
          href="/recover"
          className="mt-3 inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink hover:border-accent hover:text-accent sm:mt-0"
        >
          {t.home.registeredCta}
        </Link>
      </section>
    </div>
  );
}
