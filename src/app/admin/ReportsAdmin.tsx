"use client";

import { useEffect, useState } from "react";
import { useErrorMessage, useLocale, useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary, cardClass } from "@/components/styles";
import { fmt } from "@/i18n";
import { apiCall } from "@/lib/api";
import { formatDate } from "@/lib/donation";

interface Report {
  id: string;
  donorId: string;
  donorName: string;
  reason: "wrong_number" | "not_registered" | "harassment" | "other";
  note: string;
  at: string | null;
}

/** L2: open "Report this listing" submissions. Dismiss, or delete the donor and block the number. */
export default function ReportsAdmin({ onUnauthorized }: { onUnauthorized: () => void }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { locale } = useLocale();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiCall<{ reports: Report[] }>("/api/admin/reports", "GET").then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) setReports(res.data.reports);
      else if (res.error === "admin_unauthorized") onUnauthorized();
      else setError(res.error ?? "generic");
    });
    return () => {
      cancelled = true;
    };
  }, [onUnauthorized]);

  async function act(r: Report, action: "dismiss" | "delete") {
    setBusy(r.id);
    setError(null);
    const res =
      action === "dismiss"
        ? await apiCall(`/api/admin/reports/${r.id}`, "PATCH", { dismiss: true })
        : await apiCall(`/api/admin/donors/${r.donorId}`, "DELETE", { block: true, reportId: r.id });
    setBusy(null);
    if (res.ok || res.error === "not_found") setReports((prev) => prev?.filter((x) => x.id !== r.id) ?? prev);
    else if (res.error === "admin_unauthorized") onUnauthorized();
    else setError(res.error ?? "generic");
  }

  if (reports === null && !error) return <p className="text-base text-muted">{t.admin.reportsLoading}</p>;
  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-2xl border border-accent bg-accent-soft p-4 font-medium text-accent-deep">
          {errorMessage(error)}
        </p>
      )}
      {reports?.length === 0 && <p className="text-base text-muted">{t.admin.reportsEmpty}</p>}
      <ul className="space-y-3">
        {reports?.map((r) => (
          <li key={r.id} className={`${cardClass} space-y-2`}>
            <p className="text-lg font-bold text-ink">{fmt(t.admin.reportFor, { name: r.donorName })}</p>
            <p className="text-base text-ink">{t.report[r.reason]}</p>
            {r.note && <p className="text-sm text-muted">{r.note}</p>}
            {r.at && <p className="text-xs text-muted">{formatDate(new Date(r.at), locale)}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" disabled={busy === r.id} onClick={() => void act(r, "dismiss")} className={`${btnSecondary} min-h-11 px-4`}>
                {t.admin.reportDismiss}
              </button>
              <button type="button" disabled={busy === r.id} onClick={() => void act(r, "delete")} className={`${btnPrimary} min-h-11 px-4`}>
                {t.admin.reportDeleteBlock}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
