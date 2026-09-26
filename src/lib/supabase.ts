/**
 * Minimal Supabase REST client (no SDK needed). The publishable key is designed to be
 * public; Row Level Security on every table decides what anonymous visitors may do.
 * Every call fails soft so the app keeps working offline.
 */
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dfysnsonvykkszyiwxsg.supabase.co";
const SB_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_D6YDCrFQ-VlJ0QWQ4Wvmlw_AoiT_qRE";

export const sbEnabled = Boolean(SB_URL && SB_KEY);

async function sb(path: string, init: RequestInit = {}, timeoutMs = 7000) {
  if (!sbEnabled) throw new Error("supabase disabled");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        apikey: SB_KEY,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`supabase ${res.status}: ${body.slice(0, 200)}`);
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  } finally {
    clearTimeout(timer);
  }
}

export function sbInsert(table: string, row: Record<string, unknown>, keepalive = false) {
  return sb(`${table}`, {
    method: "POST",
    body: JSON.stringify(row),
    headers: { Prefer: "return=minimal" },
    keepalive,
  });
}

export function sbSelect<T = unknown>(table: string, query: string): Promise<T[]> {
  return sb(`${table}?${query}`, { method: "GET" }) as Promise<T[]>;
}

export function sbRpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return sb(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) }) as Promise<T>;
}

/** Upload an artisan photo to the public 'artisan-photos' bucket; returns its public URL. */
export async function sbUploadArtisanPhoto(photo: Blob): Promise<string> {
  const name = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${SB_URL}/storage/v1/object/artisan-photos/${name}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { apikey: SB_KEY, "Content-Type": "image/jpeg" },
      body: photo,
    });
    if (!res.ok) throw new Error(`upload ${res.status}`);
    return `${SB_URL}/storage/v1/object/public/artisan-photos/${name}`;
  } finally {
    clearTimeout(timer);
  }
}
