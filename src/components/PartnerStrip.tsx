"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { OrgCredit } from "@/config/app";

/**
 * A slow strip of partner logos that slides left for ever.
 *
 * The track is two identical halves and the animation moves it by exactly half its width, so the
 * second half arrives where the first began and the loop has no visible seam. Each half repeats
 * the list enough times to be at least as wide as the window - with three short names on a wide
 * monitor, a single pass would run out and leave a gap drifting across the screen.
 *
 * Only the first copy is announced and reachable; the rest are decoration.
 */
export default function PartnerStrip({ partners, label }: { partners: OrgCredit[]; label: string }) {
  const oneRef = useRef<HTMLUListElement>(null);
  const [perHalf, setPerHalf] = useState(1);

  useEffect(() => {
    const fit = () => {
      const width = oneRef.current?.scrollWidth ?? 0;
      if (width > 0) setPerHalf(Math.max(1, Math.ceil(window.innerWidth / width)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [partners.length]);

  if (partners.length === 0) return null;
  // About four seconds of travel per partner, however many copies it takes to fill the window.
  const seconds = Math.max(18, partners.length * 4) * perHalf;

  const row = (index: number) => (
    <ul
      key={index}
      ref={index === 0 ? oneRef : undefined}
      className={`flex ${index === 0 ? "" : "rk-marquee-copy"}`}
      aria-label={index === 0 ? label : undefined}
      aria-hidden={index === 0 ? undefined : true}
    >
      {partners.map((org) => (
        <li key={org.name} className="mx-1.5 shrink-0">
          <a
            href={org.url ?? undefined}
            target={org.url ? "_blank" : undefined}
            rel={org.url ? "noopener noreferrer" : undefined}
            tabIndex={index === 0 ? undefined : -1}
            className="flex min-h-14 items-center gap-3 whitespace-nowrap rounded-[14px] border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink hover:border-accent"
          >
            {org.logo && <Image src={org.logo} alt="" width={72} height={72} className="h-9 w-9 rounded-full" />}
            <span>{org.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      // Full-bleed: the strip runs edge to edge even though the page is a centred column, so the
      // cards travel off-screen rather than stopping at an invisible wall. overflow-hidden here
      // is what keeps a long list from widening the page.
      className="rk-marquee-window relative left-1/2 w-screen -translate-x-1/2 overflow-hidden"
    >
      <div className="rk-marquee" style={{ "--rk-marquee-seconds": `${seconds}s` } as CSSProperties}>
        {Array.from({ length: perHalf * 2 }, (_, i) => row(i))}
      </div>
    </div>
  );
}
