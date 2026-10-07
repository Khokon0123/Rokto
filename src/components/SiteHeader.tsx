"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useT } from "@/components/LocaleProvider";
import { APP_NAME, APP_NAME_BN } from "@/config/app";

/**
 * Red hero band at the top of every page. On the homepage and the register page it also carries the
 * page headline and is taller, so the white content card can overlap its rounded bottom edge.
 * Other pages (edit, recover) get the same band in a compact form.
 */
export default function SiteHeader() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const otherLocale = locale === "bn" ? "en" : "bn";
  const pathname = usePathname();
  const headline =
    pathname === "/"
      ? t.hero.home
      : pathname === "/register"
        ? t.hero.register
        : pathname === "/search"
          ? t.search.heading
          : pathname === "/team"
            ? t.hero.team
            : null;
  const showRegister = pathname !== "/register"; // a link to the page you're already on would do nothing
  const showTeam = pathname !== "/team";

  return (
    <header
      className={`rounded-b-[2rem] bg-gradient-to-b from-accent to-accent-dark text-white ${
        headline ? "pb-14" : "pb-6"
      }`}
    >
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-baseline gap-2 focus-visible:outline-white"
            aria-label={t.nav.home}
          >
            <span className="text-2xl font-extrabold tracking-tight">{APP_NAME}</span>
            <span className="text-lg text-white/85">{APP_NAME_BN}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {showTeam && (
              <Link
                href="/team"
                className="inline-flex min-h-12 shrink-0 items-center whitespace-nowrap text-sm font-semibold text-white/85 hover:text-white hover:underline focus-visible:outline-white"
              >
                {t.nav.team}
              </Link>
            )}
            {showRegister && (
              <Link
                href="/register"
                className="inline-flex min-h-12 shrink-0 items-center whitespace-nowrap rounded-full border border-white/70 px-4 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-white sm:px-5"
              >
                <span className="sm:hidden">{t.nav.registerShort}</span>
                <span className="hidden sm:inline">{t.nav.register}</span>
              </Link>
            )}
            {/* One tap, one pill: it shows the language you'd switch TO, so it never needs room
                for both names next to an already-tight nav on a 360px phone. */}
            <button
              type="button"
              onClick={() => setLocale(otherLocale)}
              aria-label={t.nav.switchLanguage}
              className="inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-white/40 px-3 text-xs font-bold text-white hover:bg-white/10 focus-visible:outline-white"
            >
              {otherLocale === "en" ? "EN" : "বাংলা"}
            </button>
          </div>
        </div>
        {headline && (
          <h1 className="mt-7 max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight">{headline}</h1>
        )}
      </div>
    </header>
  );
}
