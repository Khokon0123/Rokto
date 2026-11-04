"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import DonorCard from "@/components/DonorCard";
import { useLocale, useT } from "@/components/LocaleProvider";
import { btnSecondary, cardClass, errorTextClass } from "@/components/styles";
import { fmt } from "@/i18n";
import { formatNumber } from "@/i18n/locale";
import { SEARCH_PAGE_SIZE } from "@/config/app";
import { apiCall } from "@/lib/api";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/bloodGroups";
import { AREAS, areaLabel } from "@/lib/areas";
import { getCurrentPosition, haversineKm, type GeoPoint } from "@/lib/geo";
import {
  fromResponse,
  parseSearchParams,
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

/** Past this, "near me" means nowhere in Chittagong: fall back to every area rather than
 *  pretending the far edge of the district is the visitor's neighbourhood. */
const NEAR_ME_MAX_KM = 30;

const chipBase =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-semibold";
const chipOn = "border-accent bg-accent text-white";
const chipOff = "border-line bg-surface text-ink hover:bg-page";

function nearestArea(from: GeoPoint): { id: string; km: number } {
  let best = { id: AREAS[0].id, km: haversineKm(from, AREAS[0].center) };
  for (const a of AREAS) {
    const km = haversineKm(from, a.center);
    if (km < best.km) best = { id: a.id, km };
  }
  return best;
}

export default function SearchClient() {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();

  // Seed from the URL so a shared /search?group=O%2B&area=khulshi link opens on those results.
  // parseSearchParams is the same validator the API uses, so an unknown group or area id falls
  // back to "no filter" rather than querying for something that cannot exist.
  const [initial] = useState(() => parseSearchParams(new URLSearchParams(query.toString())));
  const [group, setGroup] = useState<BloodGroup | "">(initial.bloodGroup ?? "");
  const [area, setArea] = useState<string | null>(initial.area);
  const [includeCompatible, setIncludeCompatible] = useState(initial.includeCompatible);
  const [attempt, setAttempt] = useState(0);
  const [nearMe, setNearMe] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [shown, setShown] = useState(SEARCH_PAGE_SIZE);

  const areaRowRef = useRef<HTMLDivElement>(null);
  const selectedAreaRef = useRef<HTMLButtonElement>(null);

  // A shared ?area=... link can point at a chip far along the scroll row, where the visitor would
  // never see which area is selected. scrollLeft rather than scrollIntoView: that would also
  // scroll the page vertically.
  useEffect(() => {
    const row = areaRowRef.current;
    const chip = selectedAreaRef.current;
    if (!row || !chip) return;
    row.scrollLeft = Math.max(0, chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2);
  }, [area]);

  /**
   * One location read, used to pick an AREA rather than to place the visitor on a map. The point
   * never leaves the browser: it is not stored, not logged and not sent to the server.
   */
  function useMyLocation() {
    setLocating(true);
    setLocateFailed(false);
    getCurrentPosition()
      .then((p) => {
        const near = nearestArea(p);
        setArea(near.km <= NEAR_ME_MAX_KM ? near.id : null);
        setNearMe(p);
        setLocating(false);
      })
      .catch(() => {
        setLocateFailed(true);
        setLocating(false);
      });
  }

  const compatible = Boolean(group) && includeCompatible;
  const bloodGroup = group || null;

  // Mirror the filters back into the address bar so the link can be copied at any moment.
  // replace, not push: tapping through chips should not bury the previous page in history.
  const urlQuery = searchQueryString({ bloodGroup, area, includeCompatible: compatible });
  useEffect(() => {
    const current = window.location.search.replace(/^\?/, "");
    if (current === urlQuery) return;
    router.replace(urlQuery ? `${pathname}?${urlQuery}` : pathname, { scroll: false });
  }, [urlQuery, pathname, router]);

  // The list is open as soon as the page loads: someone here usually needs blood now.
  const key = `${group}|${area ?? ""}|${compatible}|${attempt}`;
  // The map ignores the area filter on purpose (panning is how you explore a map); group applies.
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
    <div className="space-y-5">
      {/* The page headline lives in the red hero band (SiteHeader). */}
      <section aria-label={t.search.heading} className="min-w-0 space-y-5 rounded-3xl border border-line bg-surface p-5 shadow-lift">
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="mb-2 block text-sm font-semibold text-ink">{t.search.bloodGroup}</legend>
          {/* Chips, not a select: in an emergency this is one thumb tap instead of open,
              scroll, confirm. Tapping the chosen group again clears it. */}
          <div className="grid grid-cols-4 gap-2">
            {BLOOD_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={group === g}
                onClick={() => setGroup(group === g ? "" : g)}
                className={`${chipBase} ${group === g ? chipOn : chipOff}`}
              >
                {g}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0 border-0 p-0">
          <AreaAutocomplete
            value={area}
            onChange={setArea}
            label={t.search.area}
            placeholder={t.search.areaPlaceholder}
          />
          {/* Negative margin plus matching padding lets the row bleed to the card's edges, so it
              reads as scrollable rather than clipped. */}
          <div className="relative -mx-5 mt-2">
            <div ref={areaRowRef} className="overflow-x-auto px-5 pb-1">
              <div className="flex w-max gap-2">
                <button
                  type="button"
                  aria-pressed={area === null}
                  onClick={() => setArea(null)}
                  className={`${chipBase} ${area === null ? chipOn : chipOff}`}
                >
                  {t.search.allAreas}
                </button>
                {AREAS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    ref={area === a.id ? selectedAreaRef : undefined}
                    aria-pressed={area === a.id}
                    onClick={() => setArea(area === a.id ? null : a.id)}
                    className={`${chipBase} ${area === a.id ? chipOn : chipOff}`}
                  >
                    {areaLabel(a.id, locale)}
                  </button>
                ))}
              </div>
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-surface via-surface/85 to-transparent"
            />
          </div>
        </fieldset>

        <div>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className={`${btnSecondary} w-full gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.6" />
            </svg>
            {locating ? t.search.locating : t.search.nearMe}
          </button>
          {locateFailed && (
            <p role="alert" className={errorTextClass}>
              {t.search.nearMeFailed}
            </p>
          )}
          {nearMe && !locateFailed && (
            <p className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-ink">{t.search.nearestFirst}</span>
              <button type="button" onClick={() => setNearMe(null)} className="min-h-11 font-semibold text-accent underline">
                {t.search.clearNearest}
              </button>
            </p>
          )}
        </div>

        {group && (
          <label className="flex min-h-14 cursor-pointer items-start gap-3 py-1">
            <input
              type="checkbox"
              checked={includeCompatible}
              onChange={(e) => setIncludeCompatible(e.target.checked)}
              className="mt-0.5 h-7 w-7 shrink-0 accent-[#a8261f]"
            />
            <span>
              <span className="block text-base font-semibold text-ink">{t.search.compatible}</span>
              <span className="block text-sm text-muted">{fmt(t.search.compatibleHint, { group })}</span>
            </span>
          </label>
        )}
      </section>

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
          <button type="button" onClick={() => setView("list")} className={`${btnSecondary} w-full`}>
            {t.search.backToList}
          </button>
        </div>
      ) : (
        <>
          {list.status === "error" ? (
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
            </div>
          ) : (
            <div aria-busy={stale}>
              {/* F1: while new filters load, old results are dimmed, their Call buttons disabled,
                  and the count (which belongs to the old filters) replaced by a progress line. */}
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
              <ul
                className={`mt-2 divide-y divide-line rounded-3xl border border-line bg-surface px-4 motion-safe:transition-opacity ${
                  stale ? "pointer-events-none opacity-40" : ""
                }`}
              >
                {displayed.map((r) => (
                  <DonorCard key={r.donor.id} result={r} stale={stale} />
                ))}
              </ul>
              {!stale && displayed.length < ordered.length && (
                <button
                  type="button"
                  className={`${btnSecondary} mt-3 w-full`}
                  onClick={() => setShown((n) => n + SEARCH_PAGE_SIZE)}
                >
                  {t.search.showMore}
                </button>
              )}
            </div>
          )}

          {/* Below the results on purpose: on a phone the first thing after filtering should be
              names you can ring, not a map to scroll past. */}
          <button type="button" onClick={() => setView("map")} className={`${btnSecondary} w-full gap-2`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
              <path d="M9 4v13" />
              <path d="M15 6.5v13" />
            </svg>
            {t.search.mapCta}
          </button>

          {/* Last, where someone who found nobody is looking. */}
          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-surface p-4">
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-ink">{t.home.choice.registerTitle}</span>
              <span className="mt-0.5 block text-sm text-muted">{t.home.choice.registerBody}</span>
            </span>
            <Link
              href="/register"
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-accent px-4 text-sm font-bold text-white hover:bg-accent-dark"
            >
              {t.home.choice.registerCta}
            </Link>
          </div>
        </>
      )}

    </div>
  );
}
