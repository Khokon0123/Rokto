"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useLocale, useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { formatNumber } from "@/i18n/locale";
import { areaLabel, getArea } from "@/lib/areas";
import { formatDate } from "@/lib/donation";
import { formatDistanceKm, type GeoPoint } from "@/lib/geo";
import type { SearchResult } from "@/lib/search";
import CallButton from "./CallButton";

// Shown when there's nothing to center on yet (no results, no "use my location"): Chittagong city.
const DEFAULT_CENTER: GeoPoint = { lat: 22.335, lng: 91.832 };
const DEFAULT_ZOOM = 12;

// One mark, every area, whatever it covers. A number here only ever restated what the list
// already says, and a bigger bubble invited people to read density into rough area centres.
const areaIcon = L.divIcon({
  className: "",
  html: '<div style="background:#a8261f;width:18px;height:18px;border-radius:9999px;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.45);"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
});

const meIcon = L.divIcon({
  className: "",
  html: '<div style="background:#2563eb;width:16px;height:16px;border-radius:9999px;border:3px solid white;box-shadow:0 0 0 5px rgba(37,99,235,0.3);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** F3: MapContainer's bounds only apply on mount, so re-fit whenever the visible set changes. */
function FitBounds({ bounds, fitKey }: { bounds: L.LatLngBounds | null; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    // fitKey is the stable identity of `bounds`; refitting on every render would fight the user's panning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  return null;
}

/**
 * One marker per AREA, never per donor. The browser is not sent donor coordinates at all (see
 * SearchResponse), so a pin can only ever mean "this many matching donors somewhere in this
 * area", drawn at the area's rough centre. That is the whole privacy model of this map: a
 * marker is a count over an area, not a person on a street.
 */
interface Pin {
  key: string;
  point: GeoPoint;
  results: SearchResult[];
}

function DonorLine({ result }: { result: SearchResult }) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <div className="space-y-1 text-ink">
      <p className="text-base font-bold">
        {result.donor.bloodGroup} {"·"} {result.donor.name}
      </p>
      <p className="text-sm text-muted">
        {result.donor.lastDonated
          ? fmt(t.card.lastDonated, { date: formatDate(result.donor.lastDonated, locale) })
          : t.card.lastDonatedNone}
        {typeof result.distanceKm === "number" && Number.isFinite(result.distanceKm) && (
          <> {"·"} {fmt(t.card.distanceAway, { distance: formatDistanceKm(result.distanceKm, locale) })}</>
        )}
      </p>
      <CallButton
        donorId={result.donor.id}
        phone={result.donor.phone}
        className="block min-h-11 text-left font-semibold text-accent underline"
      />
    </div>
  );
}

export default function DonorMap({
  results,
  from,
  area,
}: {
  results: SearchResult[];
  from: GeoPoint | null;
  /** The area picked in the filter above, if any - drawn as a rough visual ring, nothing more. */
  area: string | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const areaInfo = area ? getArea(area) : undefined;
  // Areas aren't surveyed boundaries, just approximate centres: this is a rough "roughly here" ring.
  const areaRadiusM = areaInfo?.group === "district" ? 6000 : 2000;

  const pins = useMemo(() => {
    const byArea = new Map<string, Pin>();
    for (const r of results) {
      // Keyed by area id, positioned at that area's centre: two donors in Khulshi are one pin,
      // and no pin can be traced back to an individual address.
      const point = getArea(r.donor.area)?.center ?? null;
      if (!point) continue;
      const pin = byArea.get(r.donor.area) ?? { key: r.donor.area, point, results: [] };
      pin.results.push(r);
      byArea.set(r.donor.area, pin);
    }
    return [...byArea.values()];
  }, [results]);

  const { bounds, fitKey } = useMemo(() => {
    const all: [number, number][] = pins.map((p) => [p.point.lat, p.point.lng]);
    if (from) all.push([from.lat, from.lng]);
    if (areaInfo) {
      // Include the area ring's extremes, so a searched area with few pins still lands on screen.
      const mLat = 111_320;
      const mLng = mLat * Math.cos((areaInfo.center.lat * Math.PI) / 180);
      all.push([areaInfo.center.lat + areaRadiusM / mLat, areaInfo.center.lng + areaRadiusM / mLng]);
      all.push([areaInfo.center.lat - areaRadiusM / mLat, areaInfo.center.lng - areaRadiusM / mLng]);
    }
    return {
      bounds: all.length > 0 ? L.latLngBounds(all) : null,
      fitKey: `${pins.map((p) => p.key).join("|")}#${from ? `${from.lat},${from.lng}` : ""}#${area ?? ""}`,
    };
  }, [pins, from, areaInfo, areaRadiusM, area]);

  return (
    <MapContainer
      center={from ?? DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-[70vh] max-h-[560px] w-full overflow-hidden rounded-3xl border border-line"
    >
      {/* OSM's own tile server (the {s}. subdomains are deprecated). For heavy traffic, switch to
          a tile provider with a free tier (MapTiler, Stadia, Carto) per OSM's tile usage policy. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds bounds={bounds} fitKey={fitKey} />
      {areaInfo && (
        <Circle
          center={areaInfo.center}
          radius={areaRadiusM}
          pathOptions={{ color: "#b91c1c", weight: 1.5, fillColor: "#b91c1c", fillOpacity: 0.08 }}
        />
      )}
      {from && <Marker position={from} icon={meIcon} />}
      {pins.map((pin) => {
        const single = pin.results.length === 1;
        const first = pin.results[0];
        return (
          <Marker
            key={pin.key}
            position={pin.point}
            icon={areaIcon}
          >
            <Popup maxWidth={280}>
              {single ? (
                <div className="space-y-1">
                  <p className="text-sm">{areaLabel(first.donor.area, locale)}</p>
                  <DonorLine result={first} />
                </div>
              ) : (
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  <p className="text-sm font-semibold">
                    {fmt(t.search.count, { count: formatNumber(pin.results.length, locale) })} {"·"}{" "}
                    {areaLabel(first.donor.area, locale)}
                  </p>
                  {pin.results.map((r) => (
                    <DonorLine key={r.donor.id} result={r} />
                  ))}
                </div>
              )}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
