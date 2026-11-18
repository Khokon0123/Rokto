"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/LocaleProvider";
import { CONTACT_EMAIL, ORGS } from "@/config/app";
import { fmt } from "@/i18n";

/**
 * "A, B & C" - each org (logo or name) links out if it has a url.
 * An org with a logo shows the mark instead of its name: these logos already contain
 * the name as artwork, so the text would just repeat it.
 */
function OrgCredit() {
  return (
    <>
      {ORGS.map((org, i) => (
        <span key={org.name} className="inline-flex items-center">
          {/* Two orgs read as "A & B"; three or more would become "A & B & C", so every join
              but the last is a separator instead. A middle dot, not a comma: between two 64px
              marks a comma hangs at the baseline and reads as a stray speck. */}
          {i > 0 && <span className="px-1.5">{i === ORGS.length - 1 ? "\u0026" : "\u00b7"}</span>}
          {org.logo ? (
            (() => {
              const logo = (
                <Image
                  src={org.logo}
                  alt={org.name}
                  width={128}
                  height={128}
                  className="h-16 w-16 rounded-full ring-2 ring-white/90"
                />
              );
              return org.url ? (
                <a
                  href={org.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={org.name}
                  title={org.name}
                  className="rounded-full motion-safe:transition-transform motion-safe:hover:scale-105 focus-visible:outline-white"
                >
                  {logo}
                </a>
              ) : (
                logo
              );
            })()
          ) : org.url ? (
            <a href={org.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              {org.name}
            </a>
          ) : (
            <span className="font-semibold">{org.name}</span>
          )}
        </span>
      ))}
    </>
  );
}

export default function SiteFooter({ signedIn = false }: { signedIn?: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const [before, after] = fmt(t.footer.poweredBy, { org: "\u0000" }).split("\u0000");
  // Every page except the one it points at. The header is already full on a 360px phone
  // (Team, Register, language), so this is the only place it fits site-wide.
  const showRecover = pathname !== "/recover";

  return (
    // Mirrors the header band: same red, same 2rem curve, so the page is bookended.
    <footer className="rounded-t-[2rem] bg-gradient-to-b from-accent to-accent-dark text-white">
      {/* flex-wrap, not a plain <p>: the logo is taller than the line, so the credit needs to
          sit on a baseline-free centred row that can wrap on narrow phones. */}
      {showRecover && (
        <div className="mx-auto w-full max-w-2xl px-4 pt-4 text-center">
          <Link
            href="/recover"
            className="inline-flex min-h-11 items-center text-sm text-white/85 underline underline-offset-2 hover:text-white focus-visible:outline-white"
          >
            {t.nav.recover}
          </Link>
        </div>
      )}
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4 pb-2 pt-3 text-center text-sm text-white/90">
        {before && <span>{before}</span>}
        <OrgCredit />
        {after && <span>{after}</span>}
      </div>
      <nav
        aria-label={t.nav.privacy}
        className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-x-4 px-4 pb-5 text-center text-sm text-white/85"
      >
        {/* Only for people who are not signed in: offering "Sign in" to someone who already is
            reads as a bug, and it was one. */}
        {!signedIn && pathname !== "/register" && pathname !== "/account" && (
          <Link href="/register" className="inline-flex min-h-11 items-center underline focus-visible:outline-white">
            {t.account.signIn}
          </Link>
        )}
        <Link href="/privacy" className="inline-flex min-h-11 items-center underline focus-visible:outline-white">
          {t.nav.privacy}
        </Link>
        <Link href="/terms" className="inline-flex min-h-11 items-center underline focus-visible:outline-white">
          {t.nav.terms}
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex min-h-11 items-center underline focus-visible:outline-white">
          {fmt(t.footer.contact, { email: CONTACT_EMAIL })}
        </a>
      </nav>
    </footer>
  );
}
