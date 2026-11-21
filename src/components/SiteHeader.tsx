"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HeroStats from "@/components/HeroStats";
import { useLocale, useT } from "@/components/LocaleProvider";
import { APP_NAME, APP_NAME_BN } from "@/config/app";
import type { HeroStatsData } from "@/lib/server/stats";

/**
 * Red hero band at the top of every page. On the homepage and the register page it also carries the
 * page headline and is taller, so the white content card can overlap its rounded bottom edge.
 * Other pages (edit, recover) get the same band in a compact form.
 */
export default function SiteHeader({ stats, account }: { stats?: HeroStatsData | null; account?: { username: string } | null }) {
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
            : pathname === "/signin"
              ? t.hero.signin
              : pathname === "/account"
                ? t.hero.account
                : null;
  const isHome = pathname === "/";
  const isRegister = pathname === "/register";
  const showRegister = pathname !== "/register"; // a link to the page you're already on would do nothing
  const showTeam = pathname !== "/team";

  return (
    <header
      // Homepage redesign: a deeper band with a wider corner radius, so the action cards can sit
      // over its bottom edge. Every other route keeps exactly the band it had before.
      // relative + overflow-hidden so the art layer sits under the content and is clipped by
      // the band's rounded bottom corners.
      className={`relative overflow-hidden bg-gradient-to-b from-accent to-accent-dark text-white ${
        isHome ? "rounded-b-[2.25rem] pb-28" : "rounded-b-[2rem]"
      } ${!isHome && headline ? "pb-14" : ""} ${!isHome && !headline ? "pb-6" : ""}`}
    >
      {(isHome || isRegister) && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 ${isHome ? "rk-hero-art" : "rk-register-art"}`}
        />
      )}
      <div className="relative mx-auto w-full max-w-2xl px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            // py-2 only to make the tap target 48px; the nav row is already that tall because
            // of the register pill, so this changes the hit area and not the layout.
            className="flex items-baseline gap-2 py-2 focus-visible:outline-white"
            aria-label={t.nav.home}
          >
            <span className="text-2xl font-extrabold tracking-tight">{APP_NAME}</span>
            <span className="text-lg text-white/85">{APP_NAME_BN}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {showTeam && (
              <Link
                href="/team"
                // Signed in, the account chip takes this slot on a narrow phone: four items do not
                // fit at 320px, and Team is in the footer on every page.
                className={`${
                  account ? "hidden sm:inline-flex" : "inline-flex"
                } min-h-12 shrink-0 items-center whitespace-nowrap text-sm font-semibold text-white/85 hover:text-white hover:underline focus-visible:outline-white`}
              >
                {t.nav.team}
              </Link>
            )}
            {account && (
              <Link
                href="/account"
                aria-label={t.nav.account}
                // A round avatar button, the shape people already look for at the top right. Icon
                // only at every width: the username lives on the profile page, where there is room.
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-white/40 text-white hover:bg-white/10 focus-visible:outline-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
                </svg>
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
              className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-white/40 px-3 text-xs font-bold text-white hover:bg-white/10 focus-visible:outline-white"
            >
              {otherLocale === "en" ? "EN" : "বাংলা"}
            </button>
          </div>
        </div>
        {headline && (
          <h1
            className={`mt-7 font-extrabold leading-[1.15] tracking-tight ${
              isHome ? "max-w-xl text-[2rem] sm:text-5xl" : "max-w-md text-4xl"
            }`}
          >
            {headline}
          </h1>
        )}
        {isHome && <p className="mt-3 max-w-md text-base leading-relaxed text-white/85">{t.home.heroLede}</p>}
        {isHome && stats && (
          <div className="mt-6">
            <HeroStats visits={stats.visits} available={stats.available} />
          </div>
        )}
      </div>
    </header>
  );
}
