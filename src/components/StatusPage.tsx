"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary, cardClass } from "@/components/styles";

/** Branded, bilingual 404 / error screens (F12). No technical details are shown to visitors. */
export default function StatusPage({ kind, onRetry }: { kind: "notFound" | "error"; onRetry?: () => void }) {
  const t = useT();
  const s = t.status;
  return (
    <div className={`${cardClass} space-y-4`}>
      <h1 className="text-2xl font-bold text-ink">{kind === "notFound" ? s.notFoundTitle : s.errorTitle}</h1>
      <p className="text-base text-muted">{kind === "notFound" ? s.notFoundBody : s.errorBody}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${btnPrimary} w-full`}>
          {s.tryAgain}
        </button>
      )}
      <Link href="/search" className={`${onRetry ? btnSecondary : btnPrimary} w-full`}>
        {s.goSearch}
      </Link>
    </div>
  );
}
