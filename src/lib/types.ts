export type Lang = "en" | "kn" | "hi";
export type L10n = Record<Lang, string>;

export type SiteCategory =
  | "temple"
  | "cave"
  | "nature"
  | "fort"
  | "crafts"
  | "spiritual"
  | "lake"
  | "food"
  | "architecture";

export interface Site {
  id: string;
  name: L10n;
  tagline: L10n;
  summary: L10n;
  story: L10n;
  facts: string[];
  visualCues: string;
  category: SiteCategory[];
  town: string;
  lat: number;
  lng: number;
  lesserKnown: boolean;
  unesco?: boolean;
  visitMinutes: number;
  timings: string;
  entryFee: string;
  entryFeeINR: number;
  bestTime: string;
  crowdBase: number;
  accessibility: {
    level: "good" | "partial" | "difficult";
    steps: number;
    notes: string;
    toilets: boolean;
    parking: boolean;
  };
  festivals?: { name: string; months: number[] }[];
  sources?: string[];
}

export type ArtisanCategory = "weaving" | "food" | "homestay" | "crafts" | "guide" | "other";

export interface Artisan {
  id: string;
  name: L10n;
  craft: L10n;
  description: L10n;
  category: ArtisanCategory;
  town: string;
  nearSite: string;
  lat: number;
  lng: number;
  priceHint: string;
  languages: string[];
  image: string;
  phone?: string | null;
  registered?: boolean; // came from live self-registration (Supabase)
  address?: string | null; // as typed by the artisan
  pinned?: boolean; // lat/lng captured by GPS at the shop
  photoUrl?: string | null; // photo uploaded by the artisan
}

export interface CrowdReport {
  site_id: string;
  level: number; // 1..5
  created_at: string;
}

export interface GuideMessage {
  role: "user" | "assistant";
  text: string;
  image?: string; // data URL preview (client only)
  siteId?: string | null;
  confidence?: number;
  provider?: string;
  voice?: boolean;
}

export interface GuideResponse {
  answer: string;
  siteId?: string | null;
  confidence?: number;
  transcript?: string;
  provider: "gemini" | "groq" | "offline" | "demo";
  model?: string;
}
