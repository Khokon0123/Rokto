"use client";

import { useEffect, useMemo, useState } from "react";
import BloodBadge from "@/components/BloodBadge";
import { btnPrimary, btnSecondary, cardClass, inputClass, labelClass } from "@/components/styles";
import { errorMessage, fmt, t } from "@/i18n";
import { apiCall } from "@/lib/api";
import { AREAS, getArea } from "@/lib/areas";
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

async function fetchDonors(): Promise<{ ok: boolean; donors?: AdminDonor[]; error?: string }> {
  try {
    const res = await fetch("/api/admin/donors", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { donors?: AdminDonor[]; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "server_error" };
    return { ok: true, donors: data.donors ?? [] };
  } catch {
    return { ok: false, error: "network" };
  }
}

export default function AdminClient() {
  const [donors, setDonors] = useState<AdminDonor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [area, setArea] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // A logged-in-but-expired session needs a full reload (not client-side routing) so the /admin
  // Server Component re-checks the cookie fresh; same reason the login page hard-navigates on success.
  function goToLogin(): void {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/admin/login";
  }

  useEffect(() => {
    let cancelled = false;
    fetchDonors().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setDonors(res.donors ?? []);
      } else if (res.error === "admin_unauthorized") {
        goToLogin();
      } else {
        setError(res.error ?? "generic");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await apiCall("/api/admin/logout", "POST", {});
    goToLogin();
  }

  async function confirmDelete(id: string) {
    setBusyId(id);
    const res = await apiCall(`/api/admin/donors/${id}`, "DELETE", {});
    setBusyId(null);
    setConfirmingId(null);
    if (res.ok) {
      setDonors((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
    } else {
      setError(res.error ?? "generic");
    }
  }

  const filtered = useMemo(() => {
    if (!donors) return [];
    const q = query.trim().toLowerCase();
    return donors.filter((d) => {
      if (bloodGroup && d.bloodGroup !== bloodGroup) return false;
      if (area && d.area !== area) return false;
      if (q) {
        const inName = d.name.toLowerCase().includes(q);
        const inPhone = d.phone.includes(q) || formatLocalPhone(d.phone).includes(q);
        if (!inName && !inPhone) return false;
      }
      return true;
    });
  }, [donors, query, bloodGroup, area]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t.admin.title}</h1>
        <button type="button" onClick={logout} className={`${btnSecondary} min-h-11 px-4`}>
          {t.admin.logout}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-accent bg-accent-soft p-4 font-medium text-accent-deep">
          {errorMessage(error)}
        </p>
      )}

      <div className={`${cardClass} space-y-4`}>
        <div>
          <label htmlFor="admin-search" className={labelClass}>
            {t.admin.search}
          </label>
          <input
            id="admin-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.admin.searchPlaceholder}
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-bg" className={labelClass}>
              {t.admin.filterBloodGroup}
            </label>
            <select
              id="admin-bg"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className={inputClass}
            >
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
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {donors === null && !error && <p className="text-base text-muted">{t.admin.loading}</p>}

      {donors !== null && (
        <>
          <p className="text-sm text-muted">{fmt(t.admin.count, { shown: filtered.length, total: donors.length })}</p>
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
                    <p className="text-sm text-muted">{getArea(d.area)?.label ?? d.area}</p>
                    <p className="text-sm text-muted">
                      {d.available ? t.admin.available : t.admin.unavailable}
                      {" · "}
                      {d.lastDonated ? fmt(t.card.lastDonated, { date: formatDate(new Date(d.lastDonated)) }) : t.card.lastDonatedNone}
                    </p>
                    {d.location && (
                      <a
                        href={`https://www.google.com/maps?q=${d.location.lat},${d.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-accent underline"
                      >
                        {t.card.viewLocation} {"↗"}
                      </a>
                    )}
                    {d.createdAt && (
                      <p className="mt-1 text-xs text-muted">
                        {fmt(t.admin.registered, { date: formatDate(new Date(d.createdAt)) })}
                      </p>
                    )}
                  </div>
                </div>

                {confirmingId === d.id ? (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-page p-3">
                    <p className="flex-1 text-sm font-medium text-ink">{t.admin.confirmDelete}</p>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className={`${btnSecondary} min-h-11 px-4`}
                    >
                      {t.admin.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() => void confirmDelete(d.id)}
                      className={`${btnPrimary} min-h-11 px-4`}
                    >
                      {busyId === d.id ? t.admin.deleting : t.admin.deleteConfirm}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(d.id)}
                    className="mt-4 min-h-11 text-sm font-semibold text-accent underline"
                  >
                    {t.admin.delete}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {filtered.length === 0 && <p className="text-base text-muted">{t.admin.noResults}</p>}
        </>
      )}
    </div>
  );
}
