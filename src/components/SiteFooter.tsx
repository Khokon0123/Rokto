"use client";

import Image from "next/image";
import { useT } from "@/components/LocaleProvider";
import { ORGS } from "@/config/app";
import { fmt } from "@/i18n";

/**
 * "Nandan & Green Education" - each org links out if it has a url, joined with "&".
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
            <Image
              src={org.logo}
              alt={org.name}
              width={128}
              height={128}
              className="h-16 w-16 rounded-full"
            />
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
    <footer className="border-t border-line bg-surface">
      {/* flex-wrap, not a plain <p>: the logo is taller than the line, so the credit needs to
          sit on a baseline-free centred row that can wrap on narrow phones. */}
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4 py-4 text-center text-sm text-muted">
        {before && <span>{before}</span>}
        <OrgCredit />
        {after && <span>{after}</span>}
      </div>
    </footer>
  );
}
