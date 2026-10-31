"use client";

import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { btnPrimary, btnSecondary } from "./styles";

/** Shows the private edit link. It is only ever available right now: we store just a hash. */
export default function EditLinkCard({ token }: { token: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  // S6: the token lives in the #fragment, which browsers never send to the server, so it can't
  // end up in hosting/CDN logs. /edit/<token> links issued before this change still work.
  const path = `/edit#${token}`;
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked: the link is still selectable in the box below */
    }
  }

  return (
    <div className="rounded-3xl border-2 border-accent bg-accent-soft p-5">
      <h2 className="text-lg font-bold text-accent-deep">{t.link.title}</h2>
      <p className="mt-1 text-base text-ink">{t.link.body}</p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={t.link.title}
        className="mt-3 block min-h-14 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink"
      />
      <p className="mt-3 text-sm font-semibold text-accent-deep">{t.link.onlySelf}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={copy} className={btnPrimary}>
          {copied ? t.link.copied : t.link.copy}
        </button>
        <a
          className={btnSecondary}
          href={`https://wa.me/?text=${encodeURIComponent(fmt(t.link.whatsappText, { url }))}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.link.whatsapp}
        </a>
      </div>
      <a href={path} className="mt-3 inline-flex min-h-11 items-center font-semibold text-accent underline">
        {t.link.open}
      </a>
    </div>
  );
}
