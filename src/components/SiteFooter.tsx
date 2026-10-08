"use client";

import Image from "next/image";
import { useT } from "@/components/LocaleProvider";
import { ORGS } from "@/config/app";
import { fmt } from "@/i18n";

/**
 * "Nandan & Green Education" - each org (logo or name) links out if it has a url, joined with "&".
 * An org with a logo shows the mark instead of its name: these logos already contain
 * the name as artwork, so the text would just repeat it.
 */
function OrgCredit() {
  return (
    <>
      {ORGS.map((org, i) => (
        <span key={org.name} className="inline-flex items-center">
          {i > 0 && <span className="px-1.5">&amp;</span>}
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
                  className="rounded-full transition-transform hover:scale-105 focus-visible:outline-white"
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

export default function SiteFooter() {
  const t = useT();
  const [before, after] = fmt(t.footer.poweredBy, { org: "\u0000" }).split("\u0000");

  return (
    // Mirrors the header band: same red, same 2rem curve, so the page is bookended.
    <footer className="rounded-t-[2rem] bg-gradient-to-b from-accent to-accent-dark text-white">
      {/* flex-wrap, not a plain <p>: the logo is taller than the line, so the credit needs to
          sit on a baseline-free centred row that can wrap on narrow phones. */}
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4 py-5 text-center text-sm text-white/90">
        {before && <span>{before}</span>}
        <OrgCredit />
        {after && <span>{after}</span>}
      </div>
    </footer>
  );
}
