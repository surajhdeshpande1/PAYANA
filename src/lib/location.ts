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

export interface FoundPlace {
  label: string;
  detail: string;
  lat: number;
  lng: number;
}

/**
 * Free place search restricted to Karnataka (Photon / OpenStreetMap, no key needed).
 * Returns cities, towns, villages and landmarks.
 */
export async function searchKarnataka(q: string, limit = 8): Promise<FoundPlace[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit + 4}&lang=en&bbox=74.0,11.5,78.6,18.5`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return [];
    const j = (await res.json()) as {
      features?: {
        geometry: { coordinates: [number, number] };
        properties: { name?: string; state?: string; county?: string; city?: string; district?: string; type?: string };
      }[];
    };
    const seen = new Set<string>();
    const out: FoundPlace[] = [];
    for (const f of j.features ?? []) {
      const p = f.properties;
      if (p.state !== "Karnataka" || !p.name) continue;
      const detail = [p.county || p.district || p.city, "Karnataka"].filter(Boolean).join(", ");
      const key = `${p.name}|${detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label: p.name, detail, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Approximate location of an address/town in Karnataka (address first, then town). */
export async function geocodeApprox(address: string | null | undefined, town: string) {
  const tries = [address ? `${address}, ${town}` : "", town].filter(Boolean);
  for (const q of tries) {
    const [hit] = await searchKarnataka(q, 1);
    if (hit) return { lat: +hit.lat.toFixed(6), lng: +hit.lng.toFixed(6) };
  }
  return null;
}
