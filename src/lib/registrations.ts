import { sbInsert, sbSelect } from "./supabase";
import type { Artisan, ArtisanCategory } from "./types";

export const PENDING_REG_KEY = "payana_pending_reg";

/** Good default photo per category when an artisan hasn't uploaded one. */
export const CATEGORY_PHOTO: Record<ArtisanCategory, string> = {
  weaving: "crafts/handloom",
  food: "crafts/jolada-rotti",
  homestay: "crafts/homestay",
  crafts: "crafts/stone-carving",
  guide: "sites/aihole",
  other: "crafts/lambani",
};

interface Row {
  id: string;
  name: string;
  craft: string;
  category: ArtisanCategory;
  town: string;
  phone: string | null;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  approx_lat: number | null;
  approx_lng: number | null;
  photo_url: string | null;
}

/** Approved artisans registered through the app, newest first. */
export async function fetchApprovedArtisans(): Promise<Artisan[]> {
  const rows = await sbSelect<Row>(
    "artisans",
    "select=id,name,craft,category,town,phone,description,address,lat,lng,approx_lat,approx_lng,photo_url&status=eq.approved&order=created_at.desc&limit=100",
  );
  return rows.map((r) => {
    const same = (s: string) => ({ en: s, kn: s, hi: s });
    const pinned = r.lat != null && r.lng != null;
    return {
      id: `reg-${r.id}`,
      name: same(r.name),
      craft: same(r.craft),
      description: same(r.description || r.craft),
      category: r.category,
      town: r.town,
      nearSite: "",
      // Exact GPS pin if captured; else the approximate town location (for "nearby" only).
      lat: (pinned ? r.lat : r.approx_lat) ?? 0,
      lng: (pinned ? r.lng : r.approx_lng) ?? 0,
      address: r.address,
      pinned,
      priceHint: "",
      languages: [],
      image: CATEGORY_PHOTO[r.category] ?? "crafts/handloom",
      photoUrl: r.photo_url,
      phone: r.phone,
      registered: true,
    } satisfies Artisan;
  });
}

/** Retry registrations that were saved while offline. */
export async function flushPendingRegistrations() {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_REG_KEY) || "[]");
    if (!pending.length) return;
    const still = [];
    for (const r of pending) {
      try {
        await sbInsert("artisans", r);
      } catch {
        still.push(r);
      }
    }
    localStorage.setItem(PENDING_REG_KEY, JSON.stringify(still));
  } catch {}
}
