/**
 * Google Maps links for places people register themselves.
 * A GPS pin is exact; otherwise Google geocodes the address exactly as typed.
 * Never falls back to a default town.
 */
export interface Place {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  town: string;
}

const hasPin = (p: Place) => typeof p.lat === "number" && typeof p.lng === "number" && !(p.lat === 0 && p.lng === 0);

export function placeQuery(p: Place) {
  const parts = [p.address?.trim(), p.town.trim(), "Karnataka", "India"].filter(Boolean);
  return parts.join(", ");
}

export function directionsUrl(p: Place) {
  const dest = hasPin(p) ? `${p.lat},${p.lng}` : encodeURIComponent(placeQuery(p));
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export function mapSearchUrl(p: Place) {
  const q = hasPin(p) ? `${p.lat},${p.lng}` : encodeURIComponent(placeQuery(p));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function isPinned(p: Place) {
  return hasPin(p);
}

/** Current GPS position (high accuracy). */
export function currentPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: +pos.coords.latitude.toFixed(6),
          lng: +pos.coords.longitude.toFixed(6),
          accuracy: Math.round(pos.coords.accuracy),
        }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
