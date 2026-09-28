"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import DonorCard from "@/components/DonorCard";
import { btnSecondary, cardClass, errorTextClass, inputClass, labelClass } from "@/components/styles";
import { errorMessage, fmt, t } from "@/i18n";
import { BLOOD_GROUPS, isBloodGroup, type BloodGroup } from "@/lib/bloodGroups";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getCurrentPosition, type GeoPoint } from "@/lib/geo";
import { searchDonors, sortByDistance, type SearchResult } from "@/lib/search";

const DonorMap = dynamic(() => import("@/components/DonorMap"), {
  ssr: false,
  loading: () => (
    <p className="flex h-[70vh] max-h-[560px] items-center justify-center rounded-3xl border border-line bg-surface text-base text-muted">
      {t.search.mapLoading}
    </p>
  ),
});

interface Loaded {
  key: string; // which search these results belong to
  results: SearchResult[];
  failed: boolean;
}

export default function SearchClient() {
  const [group, setGroup] = useState<BloodGroup | "">("");
  const [area, setArea] = useState<string | null>(null);
  const [includeCompatible, setIncludeCompatible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const configured = isFirebaseConfigured();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [nearMe, setNearMe] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");

  function useMyLocation() {
    setLocating(true);
    setLocateError(null);
    getCurrentPosition()
      .then((p) => {
        setNearMe(p);
        setLocating(false);
      })
      .catch((err: Error) => {
        setLocateError(err.message);
        setLocating(false);
      });
  }

  const compatible = Boolean(group) && includeCompatible;
  const key = `${group}|${area ?? ""}|${compatible}|${attempt}`;

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    searchDonors({ bloodGroup: group || null, area, includeCompatible: compatible })
      .then((results) => !cancelled && setLoaded({ key, results, failed: false }))
      .catch(() => !cancelled && setLoaded((prev) => ({ key, results: prev?.results ?? [], failed: true })));
    return () => {
      cancelled = true;
    };
  }, [key, group, area, compatible, configured]);

  // Previous results stay on screen while the next search loads, so the list never flashes empty.
  const results = loaded?.results ?? [];
  const displayed = nearMe ? sortByDistance(results, nearMe) : results;
  const status: "loading" | "error" | "ready" =
    loaded?.key !== key ? "loading" : loaded.failed ? "error" : "ready";

  return (
    <div className="space-y-6">
      {/* The page headline now lives in the red hero band (SiteHeader). */}
      <section
        aria-label={t.search.heading}
        className="space-y-5 rounded-3xl border border-line bg-surface p-5 shadow-lift"
      >
        <div>
          <label htmlFor="bloodGroup" className={labelClass}>
            {t.search.bloodGroup}
          </label>
          <select
            id="bloodGroup"
            value={group}
            onChange={(e) => setGroup(isBloodGroup(e.target.value) ? e.target.value : "")}
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

        <AreaAutocomplete
          value={area}
          onChange={setArea}
          label={t.search.area}
          placeholder={t.search.areaPlaceholder}
        />

        {group && (
          <label className="flex min-h-14 cursor-pointer items-start gap-3 py-1">
            <input
              type="checkbox"
              checked={includeCompatible}
              onChange={(e) => setIncludeCompatible(e.target.checked)}
              className="mt-0.5 h-7 w-7 shrink-0 accent-[#b91c1c]"
            />
            <span>
              <span className="block text-base font-semibold text-ink">{t.search.compatible}</span>
              <span className="block text-sm text-muted">{fmt(t.search.compatibleHint, { group })}</span>
            </span>
          </label>
        )}
      </section>

      {configured && results.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {nearMe ? (
              <>
                <span className="font-semibold text-ink">{t.search.nearestFirst}</span>
                <button
                  type="button"
                  onClick={() => setNearMe(null)}
                  className="font-semibold text-accent underline"
                >
                  {t.search.clearNearest}
                </button>
              </>
            ) : (
              <button type="button" onClick={useMyLocation} disabled={locating} className={btnSecondary}>
                {locating ? t.search.locating : t.search.useLocation}
              </button>
            )}
          </div>
          <div role="group" aria-label={t.search.viewToggle} className="flex gap-1 rounded-xl border border-line p-1">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`min-h-9 rounded-lg px-4 text-sm font-semibold ${
                  view === v ? "bg-accent text-white" : "text-ink"
                }`}
              >
                {v === "list" ? t.search.listView : t.search.mapView}
              </button>
            ))}
          </div>
        </div>
      )}
      {locateError && <p className={errorTextClass}>{errorMessage(locateError)}</p>}

      {!configured ? (
        <p className={cardClass}>{t.search.notConfigured}</p>
      ) : status === "error" ? (
        <div role="alert" className={`${cardClass} space-y-3`}>
          <p>{t.search.error}</p>
          <button type="button" className={btnSecondary} onClick={() => setAttempt((n) => n + 1)}>
            {t.search.retry}
          </button>
        </div>
      ) : status === "loading" && results.length === 0 ? (
        <p className="text-base text-muted">{t.search.loading}</p>
      ) : results.length === 0 ? (
        <div className={`${cardClass} space-y-2`}>
          <p className="text-lg font-semibold">{t.search.empty}</p>
          <p className="text-base text-muted">{t.search.emptyHint}</p>
          <Link href="/register" className="inline-flex min-h-11 items-center font-semibold text-accent underline">
            {t.search.registerCta}
          </Link>
        </div>
      ) : (
        <>
          <p aria-live="polite" className="text-sm font-semibold text-muted">
            {results.length === 1 ? t.search.countOne : fmt(t.search.count, { count: results.length })}
          </p>
          {view === "map" ? (
            <DonorMap results={displayed} from={nearMe} />
          ) : (
            <ul className="space-y-3">
              {displayed.map((r) => (
                <DonorCard key={r.donor.id} result={r} />
              ))}
            </ul>
          )}
        </>
      )}

      <p className="pt-4 text-center text-sm">
        <Link href="/recover" className="inline-flex min-h-11 items-center text-muted underline">
          {t.nav.recover}
        </Link>
      </p>
    </div>
  );
}
