// Optional "exact location" support. A donor may choose to add one on top of their required
// area; if they do, it's fuzzed server-side (never trust the client's own rounding) before it's
// ever written to the public `donors` doc, so a public profile can't be used to pinpoint a
// specific house.

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
 * Moves a point a random distance (up to radiusMeters) in a random direction, so the stored
 * location can't be read back as someone's exact doorstep. Always applied server-side, on every
 * save - the client never gets to decide its own precision.
 */
export function fuzzGeoPoint(p: GeoPoint, radiusMeters = 250): GeoPoint {
  // sqrt(random) spreads points evenly over the disk instead of clustering near the center.
  const distanceM = radiusMeters * Math.sqrt(Math.random());
  const angle = Math.random() * 2 * Math.PI;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((p.lat * Math.PI) / 180);
  return {
    lat: p.lat + (distanceM * Math.cos(angle)) / metersPerDegreeLat,
    lng: p.lng + (distanceM * Math.sin(angle)) / metersPerDegreeLng,
  };
}

/** "450 m" under a kilometer, "3.2 km" above it. */
export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return "";
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
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
