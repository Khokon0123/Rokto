"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import BloodBadge from "@/components/BloodBadge";
import { btnPrimary, btnSecondary, cardClass, inputClass, labelClass } from "@/components/styles";
import { useErrorMessage, useLocale, useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { formatNumber } from "@/i18n/locale";
import { apiCall } from "@/lib/api";
import { AREAS, areaLabel } from "@/lib/areas";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/bloodGroups";
import { formatDate } from "@/lib/donation";
import { formatLocalPhone } from "@/lib/phone";

interface AdminDonor {
  id: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  area: string;
  available: boolean;
  lastDonated: string | null;
  location: { lat: number; lng: number } | null;
  createdAt: string | null;
}

interface Page {
  donors: AdminDonor[];
  nextCursor: string | null;
}

/** H7: donors are loaded a page at a time, filtered on the server; phone lookup is exact. */
export default function DonorsAdmin({ onUnauthorized }: { onUnauthorized: () => void }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { locale } = useLocale();
  const [donors, setDonors] = useState<AdminDonor[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [area, setArea] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (after: string | null) => {
      const q = new URLSearchParams();
      if (bloodGroup) q.set("group", bloodGroup);
      if (area) q.set("area", area);
      if (phoneQuery) q.set("phone", phoneQuery);
      if (after) q.set("cursor", after);
      const res = await apiCall<Page>(`/api/admin/donors?${q}`, "GET");
      if (res.error === "admin_unauthorized") onUnauthorized();
      return res;
    },
    [bloodGroup, area, phoneQuery, onUnauthorized],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchPage(null).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) {
        setDonors(res.data.donors);
        setCursor(res.data.nextCursor);
        setError(null);
      } else setError(res.error ?? "generic");
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const res = await fetchPage(cursor);
    setLoadingMore(false);
    if (res.ok && res.data) {
      setDonors((prev) => [...(prev ?? []), ...res.data!.donors]);
      setCursor(res.data.nextCursor);
      setError(null);
    } else setError(res.error ?? "generic");
  }

  async function remove(id: string, block: boolean) {
    setBusyId(id);
    const res = await apiCall(`/api/admin/donors/${id}`, "DELETE", { block });
    setBusyId(null);
    setConfirmingId(null);
    if (res.ok) {
      setDonors((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
      setError(null); // F12: a later success clears an earlier error
    } else if (res.error === "admin_unauthorized") onUnauthorized();
    else setError(res.error ?? "generic");
  }

  function findPhone(e: FormEvent) {
    e.preventDefault();
    setDonors(null);
    setPhoneQuery(phone.trim());
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (donors ?? []).filter((d) => !q || d.name.toLowerCase().includes(q));
  }, [donors, query]);

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-2xl border border-accent bg-accent-soft p-4 font-medium text-accent-deep">
          {errorMessage(error)}
        </p>
      )}

      <div className={`${cardClass} space-y-3`}>
        <p className="text-base font-semibold text-ink">{t.admin.export}</p>
        <p className="text-sm text-muted">{t.admin.exportHint}</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/export?format=json" className={`${btnSecondary} min-h-11 px-4`}>
            {t.admin.exportJson}
          </a>
          <a href="/api/admin/export?format=csv" className={`${btnSecondary} min-h-11 px-4`}>
            {t.admin.exportCsv}
          </a>
        </div>
      </div>

      <div className={`${cardClass} space-y-4`}>
        <form onSubmit={findPhone}>
          <label htmlFor="admin-phone" className={labelClass}>
            {t.admin.search}
          </label>
          <div className="flex gap-2">
            <input
              id="admin-phone"
              value={phone}
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
            <button type="submit" className={`${btnPrimary} shrink-0 px-4`}>
              {t.admin.findPhone}
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">{t.admin.searchPhoneHint}</p>
        </form>
        <div>
          <label htmlFor="admin-search" className={labelClass}>
            {t.admin.searchPlaceholder}
          </label>
          <input id="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-bg" className={labelClass}>
              {t.admin.filterBloodGroup}
            </label>
            <select id="admin-bg" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className={inputClass}>
              <option value="">{t.search.bloodGroupAny}</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="admin-area" className={labelClass}>
              {t.admin.filterArea}
            </label>
            <select id="admin-area" value={area} onChange={(e) => setArea(e.target.value)} className={inputClass}>
              <option value="">{t.admin.allAreas}</option>
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {areaLabel(a.id, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {donors === null && !error && <p className="text-base text-muted">{t.admin.loading}</p>}

      {donors !== null && (
        <>
          <p className="text-sm text-muted">{fmt(t.admin.countPage, { shown: formatNumber(donors.length, locale) })}</p>
          <ul className="space-y-3">
            {filtered.map((d) => (
              <li key={d.id} className={cardClass}>
                <div className="flex items-start gap-4">
                  <BloodBadge group={d.bloodGroup} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-ink">{d.name}</p>
                    <a href={`tel:${d.phone}`} className="text-base font-semibold text-accent underline">
                      {formatLocalPhone(d.phone)}
                    </a>
                    <p className="text-sm text-muted">{areaLabel(d.area, locale)}</p>
                    <p className="text-sm text-muted">
                      {d.available ? t.admin.available : t.admin.unavailable}
                      {" · "}
                      {d.lastDonated
                        ? fmt(t.card.lastDonated, { date: formatDate(new Date(d.lastDonated), locale) })
                        : t.card.lastDonatedNone}
                    </p>
                    {d.createdAt && (
                      <p className="mt-1 text-xs text-muted">
                        {fmt(t.admin.registered, { date: formatDate(new Date(d.createdAt), locale) })}
                      </p>
                    )}
                  </div>
                </div>
                {confirmingId === d.id ? (
                  <div className="mt-4 space-y-3 rounded-2xl bg-page p-3">
                    <p className="text-sm font-medium text-ink">{t.admin.confirmDelete}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setConfirmingId(null)} className={`${btnSecondary} min-h-11 px-4`}>
                        {t.admin.cancel}
                      </button>
                      <button type="button" disabled={busyId === d.id} onClick={() => void remove(d.id, false)} className={`${btnPrimary} min-h-11 px-4`}>
                        {busyId === d.id ? t.admin.deleting : t.admin.deleteConfirm}
                      </button>
                      <button type="button" disabled={busyId === d.id} onClick={() => void remove(d.id, true)} className={`${btnSecondary} min-h-11 px-4`}>
                        {t.admin.deleteAndBlock}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmingId(d.id)} className="mt-4 min-h-11 text-sm font-semibold text-accent underline">
                    {t.admin.delete}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {filtered.length === 0 && <p className="text-base text-muted">{t.admin.noResults}</p>}
          {cursor && (
            <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className={`${btnSecondary} w-full`}>
              {t.admin.loadMore}
            </button>
          )}
        </>
      )}
    </div>
  );
}
