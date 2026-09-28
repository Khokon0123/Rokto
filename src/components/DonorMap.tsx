"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { fmt, t } from "@/i18n";
import { getArea } from "@/lib/areas";
import { formatDate } from "@/lib/donation";
import { formatDistanceKm, type GeoPoint } from "@/lib/geo";
import { formatLocalPhone } from "@/lib/phone";
import type { SearchResult } from "@/lib/search";

// Shown when there's nothing to center on yet (no results, no "use my location"): Chittagong city.
const DEFAULT_CENTER: GeoPoint = { lat: 22.335, lng: 91.832 };
const DEFAULT_ZOOM = 12;

/** Small colored pin matching the blood-group badge look used everywhere else. No external icon
 * image files (the classic Leaflet+bundler breakage) - it's pure CSS in a divIcon. */
function bloodIcon(group: string, dimmed: boolean): L.DivIcon {
  const negative = group.endsWith("-");
  const bg = dimmed ? "#9ca3af" : negative ? "#7f1d1d" : "#b91c1c";
  return L.divIcon({
    className: "",
    html: `<div style="background:${bg};color:#fff;font-weight:800;font-size:11px;width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.45);">${group}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}

const meIcon = L.divIcon({
  className: "",
  html: '<div style="background:#2563eb;width:16px;height:16px;border-radius:9999px;border:3px solid white;box-shadow:0 0 0 5px rgba(37,99,235,0.3);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function DonorMap({ results, from }: { results: SearchResult[]; from: GeoPoint | null }) {
  const points = useMemo(
    () =>
      results
        .map((r) => {
          const point = r.donor.location ?? getArea(r.donor.area)?.center ?? null;
          return point ? { result: r, point } : null;
        })
        .filter((x): x is { result: SearchResult; point: GeoPoint } => x !== null),
    [results],
  );

  const bounds = useMemo(() => {
    const all: [number, number][] = points.map((p) => [p.point.lat, p.point.lng]);
    if (from) all.push([from.lat, from.lng]);
    return all.length > 0 ? L.latLngBounds(all) : null;
  }, [points, from]);

  return (
    <MapContainer
      center={from ?? DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      bounds={bounds ?? undefined}
      boundsOptions={{ padding: [32, 32], maxZoom: 15 }}
      scrollWheelZoom
      className="h-[70vh] max-h-[560px] w-full overflow-hidden rounded-3xl border border-line"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {from && <Marker position={from} icon={meIcon} />}
      {points.map(({ result, point }) => (
        <Marker key={result.donor.id} position={point} icon={bloodIcon(result.donor.bloodGroup, result.coolingDown)}>
          <Popup>
            <div className="space-y-1 text-ink">
              <p className="text-base font-bold">{result.donor.name}</p>
              <p className="text-sm">{getArea(result.donor.area)?.label ?? result.donor.area}</p>
              {typeof result.distanceKm === "number" && Number.isFinite(result.distanceKm) && (
                <p className="text-sm text-muted">
                  {fmt(t.card.distanceAway, { distance: formatDistanceKm(result.distanceKm) })}
                </p>
              )}
              <p className="text-sm text-muted">
                {result.donor.lastDonated
                  ? fmt(t.card.lastDonated, { date: formatDate(result.donor.lastDonated) })
                  : t.card.lastDonatedNone}
              </p>
              <a href={`tel:${result.donor.phone}`} className="block font-semibold text-accent underline">
                {fmt(t.card.call, { phone: formatLocalPhone(result.donor.phone) })}
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
