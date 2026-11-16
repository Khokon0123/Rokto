import Image from "next/image";
import type { OrgCredit } from "@/config/app";

/**
 * A slow left-to-right strip of partner logos. The list is rendered twice: the animation slides
 * the track by exactly half its width, so the second copy arrives where the first began and the
 * loop has no visible seam. The copy is aria-hidden, so each partner is announced once.
 *
 * The window clips with overflow-hidden, so a long list never widens the page.
 */
export default function PartnerStrip({ partners, label }: { partners: OrgCredit[]; label: string }) {
  if (partners.length === 0) return null;
  // Long lists should not whip past: about four seconds of travel per partner.
  const seconds = Math.max(18, partners.length * 4);

  const item = (org: OrgCredit, copy: boolean) => (
    <li key={`${copy ? "copy-" : ""}${org.name}`} className="mx-1.5 shrink-0">
      {/* The copy is decoration; only the first set is reachable and announced. */}
      <a
        href={org.url ?? undefined}
        target={org.url ? "_blank" : undefined}
        rel={org.url ? "noopener noreferrer" : undefined}
        tabIndex={copy ? -1 : undefined}
        aria-hidden={copy || undefined}
        className="flex min-h-14 items-center gap-3 whitespace-nowrap rounded-[14px] border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink hover:border-accent"
      >
        {org.logo && <Image src={org.logo} alt="" width={72} height={72} className="h-9 w-9 rounded-full" />}
        <span>{org.name}</span>
      </a>
    </li>
  );

  const row = (copy: boolean) => (
    <ul
      className={`flex ${copy ? "rk-marquee-copy" : ""}`}
      aria-label={copy ? undefined : label}
      aria-hidden={copy || undefined}
    >
      {partners.map((org) => item(org, copy))}
    </ul>
  );

  return (
    <div
      // Full-bleed: the strip runs edge to edge even though the page is a centred column, so the
      // logos travel off-screen rather than stopping at an invisible wall. overflow-hidden here
      // is what keeps a long list from widening the page.
      className="rk-marquee-window relative left-1/2 w-screen -translate-x-1/2 overflow-hidden"
    >
      {/* Two equal halves, so sliding the track by half its width lands exactly on the seam. */}
      <div className="rk-marquee" style={{ "--rk-marquee-seconds": `${seconds}s` } as React.CSSProperties}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
