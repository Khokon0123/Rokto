"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME, APP_NAME_BN } from "@/config/app";
import { t } from "@/i18n";

/**
 * Red hero band at the top of every page. On the homepage and the register page it also carries the
 * page headline and is taller, so the white content card can overlap its rounded bottom edge.
 * Other pages (edit, recover) get the same band in a compact form.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const headline = pathname === "/" ? t.hero.home : pathname === "/register" ? t.hero.register : null;
  const showRegister = pathname !== "/register"; // a link to the page you're already on would do nothing

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
          {showRegister && (
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center rounded-full border border-white/70 px-5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-white"
            >
              {t.nav.register}
            </Link>
          )}
        </div>
        {headline && (
          <h1 className="mt-7 max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight">{headline}</h1>
        )}
      </div>
    </header>
  );
}
