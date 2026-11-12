"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import EditClient, { accountTransport } from "@/app/edit/EditClient";
import { useLocale, useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary, cardClass } from "@/components/styles";
import { fmt } from "@/i18n";
import { formatDate } from "@/lib/donation";
import { apiCall } from "@/lib/api";
import { formatLocalPhone } from "@/lib/phone";

export default function AccountClient({
  username,
  phone,
  memberSince,
  listed,
}: {
  username: string;
  phone: string;
  memberSince: string | null;
  listed: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await apiCall("/api/account/logout", "POST", {});
    // refresh() as well as replace(): the header is a server render of the cookie, so the cached
    // RSC payload has to be thrown away or the signed-in chip survives the sign-out.
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="relative -mt-14 space-y-4">
      <section className={`${cardClass} space-y-4`}>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">{t.account.username}</p>
            <p className="break-all text-xl font-extrabold tracking-tight text-accent">{username}</p>
          </div>
        </div>
        <dl className="space-y-1 text-base">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted">{t.account.phone}</dt>
            <dd className="font-semibold text-ink">{formatLocalPhone(phone)}</dd>
          </div>
          {memberSince && (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted">{t.account.memberSince}</dt>
              <dd className="font-semibold text-ink">{formatDate(new Date(`${memberSince}T00:00:00`), locale)}</dd>
            </div>
          )}
        </dl>
        <p className="text-sm leading-relaxed text-muted">{t.account.note}</p>
      </section>

      {listed ? (
        // The same editor the private link opens: one screen, one set of rules. It brings its own
        // heading, so this section adds none.
        <EditClient transport={accountTransport()} />
      ) : (
        <section className={`${cardClass} space-y-3`}>
          <h2 className="text-lg font-bold text-ink">{t.account.notListed}</h2>
          <p className="text-base leading-relaxed text-muted">{fmt(t.account.notListedBody, { name: username })}</p>
          <Link href="/register" className={`${btnPrimary} w-full`}>
            {t.nav.register}
          </Link>
        </section>
      )}

      <button type="button" onClick={signOut} disabled={busy} className={`${btnSecondary} w-full`}>
        {t.account.signOut}
      </button>
    </div>
  );
}
