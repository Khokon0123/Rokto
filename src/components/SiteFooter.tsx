"use client";

import { useT } from "@/components/LocaleProvider";
import { ORGS } from "@/config/app";
import { fmt } from "@/i18n";

/** "Nandan & Green Education" - each name links out if it has a url, joined with "&". */
function OrgCredit() {
  return (
    <>
      {ORGS.map((org, i) => (
        <span key={org.name}>
          {i > 0 && " & "}
          {org.url ? (
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
      <p className="mx-auto w-full max-w-2xl px-4 py-4 text-center text-sm text-muted">
        {before}
        <OrgCredit />
        {after}
      </p>
    </footer>
  );
}
