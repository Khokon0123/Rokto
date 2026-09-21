import { ORG_NAME, ORG_URL } from "@/config/app";
import { fmt, t } from "@/i18n";

export default function SiteFooter() {
  const [before, after] = fmt(t.footer.poweredBy, { org: "\u0000" }).split("\u0000");
  const org = ORG_URL ? (
    <a href={ORG_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
      {ORG_NAME}
    </a>
  ) : (
    <span className="font-semibold">{ORG_NAME}</span>
  );

  return (
    <footer className="border-t border-line bg-surface">
      <p className="mx-auto w-full max-w-2xl px-4 py-4 text-center text-sm text-muted">
        {before}
        {org}
        {after}
      </p>
    </footer>
  );
}
