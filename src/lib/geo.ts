// Optional "exact location" support. A donor may choose to add one on top of their required
// area; if they do, it's snapped to a coarse grid server-side (never trust the client's own
// rounding) before it's stored, so a profile can't be used to pinpoint a specific house.

import { DEFAULT_LOCALE, intlLocale, type Locale } from "@/i18n/locale";

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometers. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

// A generous box around Chittagong District (incl. Sandwip island). This only exists to catch
// obviously-wrong values (0,0; a different country, a broken sensor) - it is not a precise
// boundary, and never needs to be.
const CHATTOGRAM_BOUNDS = { minLat: 21.6, maxLat: 23.2, minLng: 91.2, maxLng: 92.3 };

export function isValidGeoPoint(v: unknown): v is GeoPoint {
  if (!v || typeof v !== "object") return false;
  const { lat, lng } = v as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= CHATTOGRAM_BOUNDS.minLat &&
    lat <= CHATTOGRAM_BOUNDS.maxLat &&
    lng >= CHATTOGRAM_BOUNDS.minLng &&
    lng <= CHATTOGRAM_BOUNDS.maxLng
  );
}

/**
 * Snaps a point to the centre of a fixed grid cell (default ~500 m). The same home always gives
 * the same public point, so repeated saves can't be averaged back to the real location (S5),
 * unlike random jitter. Always applied server-side; the client never chooses its own precision.
 */
export function snapGeoPoint(p: GeoPoint, cellMeters = 500): GeoPoint {
  const metersPerDegreeLat = 111_320;
  // A fixed reference latitude (Chittagong) keeps the longitude step identical for every point,
  // so cells never shift with the input.
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((22.5 * Math.PI) / 180);
  const stepLat = cellMeters / metersPerDegreeLat;
  const stepLng = cellMeters / metersPerDegreeLng;
  const snap = (v: number, step: number) => Number(((Math.floor(v / step) + 0.5) * step).toFixed(6));
  return { lat: snap(p.lat, stepLat), lng: snap(p.lng, stepLng) };
}

/** "450 m" under a kilometer, "3.2 km" above it - in the page's own digits and units,
 *  so a Bangla page reads "৪৫০ মি" / "৩.২ কিমি" rather than Latin figures. */
export function formatDistanceKm(km: number, locale: Locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(km)) return "";
  const meters = km < 1;
  const value = meters ? Math.max(1, Math.round(km * 1000)) : km < 10 ? Number(km.toFixed(1)) : Math.round(km);
  const opts: Intl.NumberFormatOptions = {
    style: "unit",
    unit: meters ? "meter" : "kilometer",
    unitDisplay: "short",
    maximumFractionDigits: meters ? 0 : 1,
  };
  try {
    return new Intl.NumberFormat(intlLocale(locale), opts).format(value);
  } catch {
    return `${value} ${meters ? "m" : "km"}`;
  }
}

/** Wraps the browser Geolocation API in a promise; rejects with a short error code. */
export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation_unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === err.TIMEOUT ? "geolocation_timeout" : "geolocation_denied")),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}
