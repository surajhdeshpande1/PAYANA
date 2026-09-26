import sitesA from "@/data/sites-a.json";
import sitesB from "@/data/sites-b.json";
import photos from "@/data/photos.json";
import type { Lang, Site } from "./types";

export const SITES: Site[] = [...(sitesA as Site[]), ...(sitesB as Site[])];

const byId = new Map(SITES.map((s) => [s.id, s]));

export function getSite(id: string | null | undefined): Site | undefined {
  return id ? byId.get(id) : undefined;
}

export interface PhotoInfo {
  src: string;
  title?: string;
  author?: string;
  license?: string;
  source?: string;
}

const PHOTOS = photos as Record<string, PhotoInfo>;

export function photo(key: string): PhotoInfo {
  return PHOTOS[key] ?? { src: "/images/hero.jpg" };
}

export function sitePhoto(id: string): PhotoInfo {
  return PHOTOS[`sites/${id}`] ?? photo("hero");
}

/** Names in all languages + common spellings, used for offline keyword matching. */
const ALIASES: Record<string, string[]> = {
  "badami-caves": ["badami", "cave", "caves", "vatapi", "ಗುಹೆ", "ಬಾದಾಮಿ", "गुफा", "बादामी"],
  bhutanatha: ["bhutanatha", "bhootnath", "bhutnath", "ಭೂತನಾಥ", "भूतनाथ"],
  "agastya-lake": ["agastya", "lake", "ಅಗಸ್ತ್ಯ", "ಕೆರೆ", "अगस्त्य", "झील"],
  "badami-fort": ["fort", "shivalaya", "malegitti", "ಕೋಟೆ", "ಶಿವಾಲಯ", "किला", "शिवालय"],
  aihole: ["aihole", "durga", "ravanaphadi", "meguti", "lad khan", "ಐಹೊಳೆ", "ऐहोले", "ऐहोल"],
  pattadakal: ["pattadakal", "pattadakallu", "virupaksha", "unesco", "ಪಟ್ಟದಕಲ್ಲು", "ಪಟ್ಟದಕಲ್", "पट्टदकल"],
  mahakuta: ["mahakuta", "mahakoota", "ಮಹಾಕೂಟ", "महाकूट"],
  banashankari: ["banashankari", "banashankri", "shakambhari", "ಬನಶಂಕರಿ", "बनशंकरी"],
  kudalasangama: ["kudalasangama", "kudala", "sangama", "basava", "basavanna", "ಕೂಡಲಸಂಗಮ", "ಬಸವ", "कूडलसंगम", "बसव"],
  siddhanakolla: ["siddhanakolla", "siddanakolla", "ಸಿದ್ಧನಕೊಳ್ಳ", "सिद्धनकोल्ला"],
  ilkal: ["ilkal", "ilkal saree", "saree", "sari", "ಇಳಕಲ್", "ಇಲಕಲ್", "ಸೀರೆ", "इलकल", "साड़ी"],
  guledgudda: ["guledgudda", "khana", "khann", "ಗುಳೇದಗುಡ್ಡ", "ಖಣ", "गुलेदगुड्ड", "खण"],
};

export function findSiteInText(text: string): Site | undefined {
  const t = text.toLowerCase();
  let best: { site: Site; len: number } | undefined;
  for (const s of SITES) {
    const words = [...(ALIASES[s.id] ?? []), s.name.en.toLowerCase(), s.name.kn, s.name.hi];
    for (const w of words) {
      if (w && t.includes(w.toLowerCase()) && (!best || w.length > best.len)) {
        best = { site: s, len: w.length };
      }
    }
  }
  return best?.site;
}

export function siteName(s: Site | undefined, lang: Lang): string {
  return s ? s.name[lang] || s.name.en : "";
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function mapsDirUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
