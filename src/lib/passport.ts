import { SITES, getSite } from "./sites";

export function passportPoints(stamps: Record<string, number>) {
  return Object.keys(stamps).reduce((sum, id) => sum + (getSite(id)?.lesserKnown ? 20 : 10), 0);
}

export function badges(stamps: Record<string, number>, flags: { artisanContacted: boolean; crowdReported: boolean }) {
  const ids = Object.keys(stamps);
  const gems = ids.filter((id) => getSite(id)?.lesserKnown).length;
  const tri = ["badami-caves", "aihole", "pattadakal"].every((id) => ids.includes(id));
  return [
    { key: "explorer", icon: "🏛️", earned: ids.length >= 3, progress: `${Math.min(ids.length, 3)}/3` },
    { key: "gems", icon: "💎", earned: gems >= 2, progress: `${Math.min(gems, 2)}/2` },
    { key: "triangle", icon: "🔱", earned: tri, progress: "" },
    { key: "ally", icon: "🧵", earned: flags.artisanContacted, progress: "" },
    { key: "helper", icon: "📣", earned: flags.crowdReported, progress: "" },
  ];
}

export const TOTAL_SITES = SITES.length;
