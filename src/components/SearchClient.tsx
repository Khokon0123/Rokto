"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import DonorCard from "@/components/DonorCard";
import { useErrorMessage, useLocale, useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary, cardClass, errorTextClass, inputClass, labelClass } from "@/components/styles";
import { fmt } from "@/i18n";
import { formatNumber } from "@/i18n/locale";
import { SEARCH_PAGE_SIZE } from "@/config/app";
import { apiCall } from "@/lib/api";
import { BLOOD_GROUPS, isBloodGroup, type BloodGroup } from "@/lib/bloodGroups";
import { getCurrentPosition, type GeoPoint } from "@/lib/geo";
import {
  fromResponse,
  searchQueryString,
  sortByDistance,
  type SearchParams,
  type SearchResponse,
  type SearchResult,
} from "@/lib/search";

// Locale-less by design: this fallback is top-level (outside the component, so dynamic() only
// ever loads the chunk once) and only shows for the brief moment the map code downloads - a
// plain pulse skeleton needs no translated copy at all.
const DonorMap = dynamic(() => import("@/components/DonorMap"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="h-[70vh] max-h-[560px] w-full rounded-3xl border border-line bg-surface motion-safe:animate-pulse"
    />
  ),
});

interface Loaded {
  key: string; // which search these results belong to
  results: SearchResult[];
  total: number;
  truncated: boolean;
  /** false, or why it failed: the visitor's connection, or our side being down. */
  failed: false | "network" | "server";
}

async function runSearch(params: SearchParams): Promise<Omit<Loaded, "key">> {
  const res = await apiCall<SearchResponse>(`/api/search?${searchQueryString(params)}`, "GET");
  if (!res.ok || !res.data) {
    return { results: [], total: 0, truncated: false, failed: res.status === 0 ? "network" : "server" };
  }
  return { results: fromResponse(res.data, params), total: res.data.total, truncated: res.data.truncated, failed: false };
}

/** Loads `params` whenever `key` changes (or `enabled` turns on). Old data stays until the new
 *  data arrives, but callers must treat it as stale while `loaded.key !== key` (F1, F2). */
function useSearch(key: string, params: SearchParams, enabled: boolean) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const paramsJson = JSON.stringify(params);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void runSearch(JSON.parse(paramsJson) as SearchParams).then((r) => !cancelled && setLoaded({ key, ...r }));
    return () => {
      cancelled = true;
    };
  }, [key, enabled, paramsJson]);
  const status: "loading" | "error" | "ready" = loaded?.key !== key ? "loading" : loaded.failed ? "error" : "ready";
  return { loaded, status };
}

export default function SearchClient() {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { locale } = useLocale();
  const [group, setGroup] = useState<BloodGroup | "">("");
  const [area, setArea] = useState<string | null>(null);
  const [includeCompatible, setIncludeCompatible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [nearMe, setNearMe] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [shown, setShown] = useState(SEARCH_PAGE_SIZE);

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
  const bloodGroup = group || null;
  // The list is opened as soon as the page loads: someone here usually needs blood now.
  const key = `${group}|${area ?? ""}|${compatible}|${attempt}`;
  // The map ignores the area filter on purpose (panning is how you explore a map); blood group still applies.
  const mapKey = `${group}|${compatible}|${attempt}`;
  const list = useSearch(key, { bloodGroup, area, includeCompatible: compatible }, true);
  const map = useSearch(mapKey, { bloodGroup, area: null, includeCompatible: compatible }, view === "map");

  // A new filter starts from the first page again.
  const [pageKey, setPageKey] = useState(key);
  if (pageKey !== key) {
    setPageKey(key);
    setShown(SEARCH_PAGE_SIZE);
  }

  const results = list.loaded?.results ?? [];
  const stale = list.status === "loading" && results.length > 0;
  const ordered = nearMe ? sortByDistance(results, nearMe) : results;
  const displayed = ordered.slice(0, shown);
  const total = list.loaded?.total ?? 0;

  // Stale pins are hidden rather than shown with the wrong group (F2).
  const mapResults = map.status === "ready" ? (map.loaded?.results ?? []) : [];
  const mapDisplayed = nearMe ? sortByDistance(mapResults, nearMe) : mapResults;

  return (
    <div className="space-y-6">
      {/* The page headline lives in the red hero band (SiteHeader). */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAttempt((n) => n + 1);
        }}
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

        <button type="submit" className={`${btnPrimary} w-full`}>
          {t.search.searchCta}
        </button>
      </form>

      {(
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
            ) : null}
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
      {/* Distance is the first thing you want in an emergency, but it can only be worked out from
          the searcher's own position - so ask for it with the reason stated, rather than leaving
          it behind an unexplained "use my location" button that most people scroll straight past. */}
      {!nearMe && (view === "map" || results.length > 0) && (
        <div className="rounded-3xl border-2 border-accent bg-accent-soft p-5">
          <p className="text-lg font-bold text-accent-deep">{t.search.distanceTitle}</p>
          <p className="mt-1 text-base text-ink">{t.search.distanceBody}</p>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className={`${btnPrimary} mt-4 w-full`}
          >
            {locating ? t.search.locating : t.search.useLocation}
          </button>
        </div>
      )}
      {locateError && <p className={errorTextClass}>{errorMessage(locateError)}</p>}

      {view === "map" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t.search.mapAllAreas}</p>
          {map.status === "error" ? (
            <div role="alert" className={`${cardClass} space-y-3`}>
              <p>{t.search.mapError}</p>
              <button type="button" className={btnSecondary} onClick={() => setAttempt((n) => n + 1)}>
                {t.search.retry}
              </button>
            </div>
          ) : (
            <div className="relative" aria-busy={map.status === "loading"}>
              {map.status === "loading" && (
                <p
                  role="status"
                  className="absolute inset-x-0 top-3 z-[1000] mx-auto w-fit rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-card"
                >
                  {t.search.mapLoading}
                </p>
              )}
              <DonorMap results={mapDisplayed} from={nearMe} area={area} />
            </div>
          )}
        </div>
      ) : list.status === "error" ? (
        <div role="alert" className={`${cardClass} space-y-3`}>
          <p>{list.loaded?.failed === "server" ? t.search.unavailable : t.search.error}</p>
          <button type="button" className={btnSecondary} onClick={() => setAttempt((n) => n + 1)}>
            {t.search.retry}
          </button>
        </div>
      ) : list.status === "loading" && results.length === 0 ? (
        <p role="status" className="text-base text-muted">
          {t.search.loading}
        </p>
      ) : results.length === 0 ? (
        <div className={`${cardClass} space-y-2`}>
          <p className="text-lg font-semibold">{t.search.empty}</p>
          <p className="text-base text-muted">{t.search.emptyHint}</p>
          <Link href="/register" className="inline-flex min-h-11 items-center font-semibold text-accent underline">
            {t.search.registerCta}
          </Link>
        </div>
      ) : (
        <div aria-busy={stale}>
          {/* F1: while new filters load, old results are dimmed, their Call buttons disabled, and
              the count (which belongs to the old filters) is replaced by a progress line. */}
          <p aria-live="polite" className="text-sm font-semibold text-muted">
            {stale
              ? t.search.updating
              : total === 1
                ? t.search.countOne
                : fmt(t.search.count, { count: formatNumber(total, locale) })}
          </p>
          {!stale && list.loaded?.truncated && (
            <p className="mt-1 text-sm text-muted">
              {fmt(t.search.truncated, { count: formatNumber(results.length, locale) })}
            </p>
          )}
          <ul className={`mt-3 space-y-3 motion-safe:transition-opacity ${stale ? "pointer-events-none opacity-40" : ""}`}>
            {displayed.map((r) => (
              <DonorCard key={r.donor.id} result={r} stale={stale} />
            ))}
          </ul>
          {!stale && displayed.length < ordered.length && (
            <button
              type="button"
              className={`${btnSecondary} mt-4 w-full`}
              onClick={() => setShown((n) => n + SEARCH_PAGE_SIZE)}
            >
              {t.search.showMore}
            </button>
          )}
        </div>
      )}

      <p className="pt-4 text-center text-sm">
        <Link href="/recover" className="inline-flex min-h-11 items-center text-muted underline">
          {t.nav.recover}
        </Link>
      </p>
    </div>
  );
}
