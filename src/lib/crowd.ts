import type { CrowdReport, Site } from "./types";

/**
 * Transparent crowd-prediction model.
 * crowd% = siteBase × hourCurve × dayOfWeek × season × holiday × festival,
 * blended with live visitor reports from the last 2 hours.
 * Every factor is explainable to judges and tunable by the Tourism Dept.
 */

// Share of peak footfall by hour of day (sites open roughly 6 AM – 7 PM).
const HOUR_CURVE = [
  0.02, 0.02, 0.02, 0.02, 0.02, 0.05, 0.15, 0.25, 0.36, 0.52, 0.7, 0.85, 0.95, 0.9, 0.8, 0.68,
  0.58, 0.46, 0.3, 0.12, 0.05, 0.02, 0.02, 0.02,
];
// Sun..Sat
const DAY_FACTOR = [1.45, 0.82, 0.8, 0.82, 0.85, 1.0, 1.3];
// Jan..Dec: winter peak season, hot Apr–May, monsoon dip.
const MONTH_FACTOR = [1.2, 1.1, 0.9, 0.7, 0.7, 0.65, 0.7, 0.8, 0.85, 1.05, 1.15, 1.25];

// Public holidays & long weekends that spike domestic travel (YYYY-MM-DD).
const HOLIDAYS = new Set([
  "2026-09-14", // Ganesh Chaturthi
  "2026-10-02", // Gandhi Jayanti
  "2026-10-19",
  "2026-10-20", // Dasara / Vijayadashami
  "2026-11-01", // Kannada Rajyotsava
  "2026-11-08", // Deepavali
  "2026-11-09",
  "2026-12-25",
  "2027-01-01",
  "2027-01-14", // Makara Sankranti
  "2027-01-15",
  "2027-01-26",
  "2027-03-06", // Maha Shivaratri (approx.)
]);

export type CrowdLevel = "calm" | "moderate" | "busy" | "packed";

export const LEVEL_COLOR: Record<CrowdLevel, string> = {
  calm: "#5fcf80",
  moderate: "#f0c14b",
  busy: "#f08a3c",
  packed: "#e5533d",
};

export function levelOf(pct: number): CrowdLevel {
  if (pct < 40) return "calm";
  if (pct < 62) return "moderate";
  if (pct < 82) return "busy";
  return "packed";
}

function ymd(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isOpenHour(d: Date) {
  const h = d.getHours();
  return h >= 6 && h < 19;
}

export interface CrowdFactors {
  base: number;
  hour: number;
  day: number;
  season: number;
  holiday: number;
  festival: number;
}

export function modelFactors(site: Site, d: Date): CrowdFactors {
  const h = d.getHours() + d.getMinutes() / 60;
  const lo = Math.floor(h) % 24;
  const hi = (lo + 1) % 24;
  const t = h - Math.floor(h);
  const hour = HOUR_CURVE[lo] * (1 - t) + HOUR_CURVE[hi] * t;
  const month = d.getMonth() + 1;
  const festival = site.festivals?.some((f) => f.months.includes(month)) ? 1.35 : 1;
  return {
    base: site.crowdBase,
    hour,
    day: DAY_FACTOR[d.getDay()],
    season: MONTH_FACTOR[d.getMonth()],
    holiday: HOLIDAYS.has(ymd(d)) ? 1.35 : 1,
    festival,
  };
}

export function modelCrowd(site: Site, d: Date): number {
  const f = modelFactors(site, d);
  const v = f.base * f.hour * f.day * f.season * f.holiday * f.festival;
  return Math.max(2, Math.min(100, Math.round(v)));
}

const LEGACY_RATING = [0, 1, 3, 6, 8, 10];

/** Visitor rating 1–10 (10 = packed) → crowd index 5–95. */
export function ratingPct(r: CrowdReport) {
  const rating = r.rating ?? LEGACY_RATING[Math.max(1, Math.min(5, r.level ?? 3))];
  return Math.round(5 + ((Math.max(1, Math.min(10, rating)) - 1) / 9) * 90);
}

/** Blend model with fresh visitor reports (only when looking at "now"). */
export function crowdAt(
  site: Site,
  d: Date,
  reports: CrowdReport[] = [],
  live = true,
): { pct: number; level: CrowdLevel; reports: number } {
  const model = modelCrowd(site, d);
  if (!live) return { pct: model, level: levelOf(model), reports: 0 };
  const now = d.getTime();
  let wSum = 0;
  let vSum = 0;
  let n = 0;
  for (const r of reports) {
    if (r.site_id !== site.id) continue;
    const ageMin = (now - new Date(r.created_at).getTime()) / 60000;
    if (ageMin < 0 || ageMin > 120) continue;
    const w = 1 - ageMin / 120; // newer reports count more
    wSum += w;
    vSum += w * ratingPct(r);
    n++;
  }
  if (!n) return { pct: model, level: levelOf(model), reports: 0 };
  const weight = Math.min(0.75, 0.3 * wSum);
  const pct = Math.round(model * (1 - weight) + (vSum / wSum) * weight);
  return { pct, level: levelOf(pct), reports: n };
}

/** Hourly forecast 6 AM – 7 PM for a day. */
export function hourlyForecast(site: Site, day: Date) {
  const out: { hour: number; pct: number; level: CrowdLevel }[] = [];
  for (let h = 6; h <= 19; h++) {
    const d = new Date(day);
    d.setHours(h, 0, 0, 0);
    const pct = modelCrowd(site, d);
    out.push({ hour: h, pct, level: levelOf(pct) });
  }
  return out;
}

export function bestHours(site: Site, day: Date) {
  const f = hourlyForecast(site, day).filter((x) => x.hour >= 6 && x.hour <= 17);
  const min = Math.min(...f.map((x) => x.pct));
  return f.filter((x) => x.pct <= min + 6).map((x) => x.hour);
}

export function fmtHour(h: number) {
  const hh = ((h + 11) % 12) + 1;
  return `${hh} ${h < 12 ? "AM" : "PM"}`;
}

export function fmtTime(d: Date) {
  let h = d.getHours();
  const m = `${d.getMinutes()}`.padStart(2, "0");
  const ap = h < 12 ? "AM" : "PM";
  h = ((h + 11) % 12) + 1;
  return `${h}:${m} ${ap}`;
}

/** Next Sunday (or today if Sunday) at 12:00 — the demo "story" moment. */
export function nextSundayNoon(from = new Date()) {
  const d = new Date(from);
  const add = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  d.setHours(12, 0, 0, 0);
  return d;
}
