"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { btnSecondary, cardClass } from "@/components/styles";
import { apiCall } from "@/lib/api";

export default function AccountClient({ username }: { username: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await apiCall("/api/seeker/logout", "POST", {});
    // refresh() as well as replace(): the header is a server render of the cookie, so the cached
    // RSC payload has to be thrown away or the signed-in chip survives the sign-out.
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="relative -mt-14">
      <div className={`${cardClass} space-y-5`}>
        <div className="rounded-2xl border border-line bg-page p-4">
          <p className="text-sm font-semibold text-muted">{t.account.username}</p>
          <p className="mt-1 break-all text-2xl font-extrabold tracking-tight text-accent">{username}</p>
        </div>
        <p className="text-base leading-relaxed text-muted">{t.account.note}</p>
        <button type="button" onClick={signOut} disabled={busy} className={`${btnSecondary} w-full`}>
          {t.account.signOut}
        </button>
      </div>
    </div>
  );
}
