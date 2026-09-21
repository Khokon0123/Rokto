"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import DonorCard from "@/components/DonorCard";
import { btnSecondary, cardClass, inputClass, labelClass } from "@/components/styles";
import { fmt, t } from "@/i18n";
import { BLOOD_GROUPS, isBloodGroup, type BloodGroup } from "@/lib/bloodGroups";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { searchDonors, type SearchResult } from "@/lib/search";

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
          <ul className="space-y-3">
            {results.map((r) => (
              <DonorCard key={r.donor.id} result={r} />
            ))}
          </ul>
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
