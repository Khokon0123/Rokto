"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import HomeDonorCard from "@/components/HomeDonorCard";
import { useLocale, useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { formatNumber } from "@/i18n/locale";
import { apiCall } from "@/lib/api";
import { AREAS, areaLabel, getArea } from "@/lib/areas";
import { BLOOD_GROUPS, isBloodGroup, type BloodGroup } from "@/lib/bloodGroups";
import { fromResponse, searchQueryString, type SearchParams, type SearchResponse, type SearchResult } from "@/lib/search";

/** Ten at a time here, not the 30 /search uses: this list sits inside a card on the homepage. */
const HOME_PAGE_SIZE = 10;

const chipBase =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-semibold";
const chipOn = "border-accent bg-accent text-white";
const chipOff = "border-line bg-surface text-ink hover:bg-page";

interface Loaded {
  key: string;
  results: SearchResult[];
  total: number;
  failed: boolean;
}

export default function HomeSearch() {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();

  // The URL is the source of truth, so a search can be copied out of the address bar and
  // shared: ?group=O%2B&area=khulshi reopens exactly these results.
  const group: BloodGroup | "" = isBloodGroup(query.get("group")) ? (query.get("group") as BloodGroup) : "";
  const areaParam = query.get("area");
  const area = areaParam && getArea(areaParam) ? areaParam : null;

  const areaRowRef = useRef<HTMLDivElement>(null);
  const selectedAreaRef = useRef<HTMLButtonElement>(null);

  // A shared ?area=... link can point at a chip sitting far along the scroll row, where the
  // visitor would never see which area is actually selected. Nudge the row so it's visible.
  // scrollLeft rather than scrollIntoView: that would also scroll the page vertically.
  useEffect(() => {
    const row = areaRowRef.current;
    const chip = selectedAreaRef.current;
    if (!row || !chip) return;
    row.scrollLeft = Math.max(0, chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2);
  }, [area]);

  const [shown, setShown] = useState(HOME_PAGE_SIZE);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const key = `${group}|${area ?? ""}|${attempt}`;
  const enabled = Boolean(group); // a blood group is required before anyone's details load

  useEffect(() => {
    // No clearing of `loaded` here: setState in an effect body causes a cascading render, and
    // it was never needed. `status` already reports "idle" whenever no group is chosen, and
    // nothing reads `loaded` in that state. Re-picking the same group then shows its previous
    // results instantly while the refetch below replaces them.
    if (!enabled) return;
    let cancelled = false;
    const params: SearchParams = { bloodGroup: group || null, area, includeCompatible: false };
    void apiCall<SearchResponse>(`/api/search?${searchQueryString(params)}`, "GET").then((res) => {
      if (cancelled) return;
      if (!res.ok || !res.data) {
        setLoaded({ key, results: [], total: 0, failed: true });
        return;
      }
      setLoaded({ key, results: fromResponse(res.data, params), total: res.data.total, failed: false });
    });
    return () => {
      cancelled = true;
    };
  }, [key, enabled, group, area]);

  // Any change of filter starts the list from the top again.
  const [pageKey, setPageKey] = useState(key);
  if (pageKey !== key) {
    setPageKey(key);
    setShown(HOME_PAGE_SIZE);
  }

  function go(next: { group?: BloodGroup | ""; area?: string | null }) {
    const g = next.group !== undefined ? next.group : group;
    const a = next.area !== undefined ? next.area : area;
    const q = new URLSearchParams();
    if (g) q.set("group", g);
    if (a) q.set("area", a);
    const qs = q.toString();
    // replace, not push: tapping through chips shouldn't bury the previous page under
    // a dozen history entries. scroll:false keeps the viewport where the thumb is.
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const status: "idle" | "loading" | "error" | "ready" = !enabled
    ? "idle"
    : loaded?.key !== key
      ? "loading"
      : loaded.failed
        ? "error"
        : "ready";
  const results = status === "ready" ? (loaded?.results ?? []) : [];
  const displayed = results.slice(0, shown);
  const total = loaded?.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold text-ink">{t.homeSearch.groupLegend}</legend>
        <div className="grid grid-cols-4 gap-2">
          {BLOOD_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={group === g}
              onClick={() => go({ group: group === g ? "" : g })}
              className={`${chipBase} ${group === g ? chipOn : chipOff}`}
            >
              {g}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold text-ink">{t.homeSearch.areaLegend}</legend>
        {/* Negative margin + matching padding lets the row bleed to the card's edges, so it
            reads as scrollable instead of looking like a clipped list. */}
        <div className="relative -mx-6">
          <div ref={areaRowRef} className="overflow-x-auto px-6 pb-1">
            <div className="flex w-max gap-2">
              <button
                type="button"
                aria-pressed={area === null}
                onClick={() => go({ area: null })}
                className={`${chipBase} ${area === null ? chipOn : chipOff}`}
              >
                {t.homeSearch.allAreas}
              </button>
              {AREAS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  ref={area === a.id ? selectedAreaRef : undefined}
                  aria-pressed={area === a.id}
                  onClick={() => go({ area: area === a.id ? null : a.id })}
                  className={`${chipBase} ${area === a.id ? chipOn : chipOff}`}
                >
                  {areaLabel(a.id, locale)}
                </button>
              ))}
            </div>
          </div>
          {/* Right-edge fade: the only cue that this row keeps going past the card's edge. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-surface via-surface/85 to-transparent"
          />
        </div>
      </fieldset>

      {status === "idle" && <p className="text-sm text-muted">{t.homeSearch.pickGroup}</p>}

      {status === "loading" && (
        <p role="status" className="text-sm text-muted">
          {t.search.loading}
        </p>
      )}

      {status === "error" && (
        <div role="alert" className="rounded-[18px] border border-line bg-page p-4">
          <p className="text-sm text-ink">{t.search.error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-2 min-h-11 text-sm font-bold text-accent underline"
          >
            {t.search.retry}
          </button>
        </div>
      )}

      {status === "ready" && results.length === 0 && (
        <div className="rounded-[18px] border border-line bg-page p-4">
          <p className="text-base font-semibold text-ink">{t.homeSearch.empty}</p>
          <p className="mt-1 text-sm text-muted">
            {area ? t.homeSearch.emptyHintArea : t.homeSearch.emptyHintAll}
          </p>
          {area && (
            <button
              type="button"
              onClick={() => go({ area: null })}
              className="mt-2 min-h-11 text-sm font-bold text-accent underline"
            >
              {t.homeSearch.showAllAreas}
            </button>
          )}
        </div>
      )}

      {status === "ready" && results.length > 0 && (
        <div>
          <p aria-live="polite" className="text-sm font-semibold text-muted">
            {total === 1 ? t.homeSearch.countOne : fmt(t.homeSearch.count, { count: formatNumber(total, locale) })}
          </p>
          <ul className="mt-2 divide-y divide-line border-t border-line">
            {displayed.map((r) => (
              <HomeDonorCard key={r.donor.id} result={r} />
            ))}
          </ul>
          {displayed.length < results.length && (
            <button
              type="button"
              onClick={() => setShown((n) => n + HOME_PAGE_SIZE)}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-page"
            >
              {t.homeSearch.showMore}
            </button>
          )}
        </div>
      )}

      <Link href="/search" className="mt-auto inline-flex min-h-11 items-center text-sm font-semibold text-accent underline">
        {t.homeSearch.allFilters} {"→"}
      </Link>
    </div>
  );
}
