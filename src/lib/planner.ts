import { SAMPLE_ARTISANS } from "./artisans";
import { levelOf, type CrowdLevel } from "./crowd";
import { SITES, haversineKm } from "./sites";
import type { Artisan, Site, SiteCategory } from "./types";

export type Interest = "temples" | "history" | "nature" | "crafts" | "spiritual";
export type Mode = "car" | "bus" | "bike";

export const INTERESTS: Interest[] = ["temples", "history", "nature", "crafts", "spiritual"];

/** Quick-pick starting points across Karnataka (any place can also be searched). */
export const QUICK_STARTS: { label: string; lat: number; lng: number }[] = [
  { label: "Badami", lat: 15.9179, lng: 75.6789 },
  { label: "Bagalkote", lat: 16.1817, lng: 75.6958 },
  { label: "Hubballi", lat: 15.3647, lng: 75.124 },
  { label: "Vijayapura", lat: 16.8302, lng: 75.71 },
  { label: "Belagavi", lat: 15.8497, lng: 74.4977 },
  { label: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { label: "Mysuru", lat: 12.2958, lng: 76.6394 },
  { label: "Hosapete (Hampi)", lat: 15.2689, lng: 76.3909 },
];

const INTEREST_CATS: Record<Interest, SiteCategory[]> = {
  temples: ["temple", "cave", "architecture"],
  history: ["fort", "architecture", "cave"],
  nature: ["nature", "lake"],
  crafts: ["crafts"],
  spiritual: ["spiritual", "temple"],
};

export interface StartPoint {
  label: string;
  lat: number;
  lng: number;
}

export interface PlanInput {
  start: StartPoint;
  startAt: Date;
  endAt: Date;
  budget: number;
  people: number;
  interests: Interest[];
  mode: Mode;
  avoidCrowds: boolean;
  accessible: boolean;
  /** Approved, located artisans registered through the app (recommended before samples). */
  artisans?: Artisan[];
  builtins?: Artisan[]; // built-in listings still shown (admin may remove some)
}

export interface Leg {
  km: number;
  minutes: number;
  walk: boolean;
}

export interface Stop {
  site: Site;
  arrive: Date;
  depart: Date;
  day: number; // 1-based day of the journey
  pct: number;
  level: CrowdLevel;
  leg: Leg;
  lunchBefore: boolean;
  overnightBefore: boolean;
  artisan?: Artisan;
  stay?: Artisan; // homestay suggestion for the night before this stop
}

export interface Reroute {
  kind: "shift" | "swap";
  siteId: string;
  toTime: Date;
  toPct: number;
  fromTime?: Date;
  fromPct?: number;
  replacedId?: string;
  replacedPct?: number;
}

export interface Plan {
  stops: Stop[];
  totalKm: number;
  driveMinutes: number;
  endAt: Date;
  days: number;
  nights: number;
  costPerPerson: number;
  co2Kg: number;
  co2BusKg: number;
  co2CarKg: number;
  avgPct: number;
  naiveAvgPct: number;
  reroutes: Reroute[];
  overBudget: boolean;
  start: StartPoint;
}

type CrowdFn = (site: Site, at: Date) => number;

const OPEN = 6; // sites open ~6 AM
const LAST_ENTRY = 17.75; // no new entries after 5:45 PM
const CLOSE = 18.5; // everyone out by ~6:30 PM
const DAY_START = 8; // after an overnight stay, set off at 8 AM

export function legBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }, mode: Mode): Leg {
  const d = haversineKm(a, b);
  if (d < 1.3) {
    return { km: +(d * 1.25).toFixed(1), minutes: Math.round(((d * 1.25) / 4.2) * 60) + 3, walk: true };
  }
  const km = d * 1.3;
  const highway = km > 60; // long drives run on highways
  const speed = mode === "car" ? (highway ? 55 : 42) : mode === "bike" ? (highway ? 45 : 36) : highway ? 45 : 30;
  const overhead = mode === "bus" ? 12 : 4;
  return { km: +km.toFixed(1), minutes: Math.round((km / speed) * 60) + overhead, walk: false };
}

function interestMatch(site: Site, interests: Interest[]) {
  if (!interests.length) return 1;
  return interests.filter((i) => INTEREST_CATS[i].some((c) => site.category.includes(c))).length;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

interface SeqItem {
  site: Site;
  arrive: number;
  depart: number;
  pct: number;
  lunch: boolean;
  overnight: boolean;
  leg: Leg;
}

interface Node {
  seq: SeqItem[];
  pos: { lat: number; lng: number };
  time: number; // minutes after startAt
  score: number;
  lunchDay: string;
  used: Set<string>;
}

function search(input: PlanInput, crowd: CrowdFn, smart: boolean) {
  const start = input.start;
  const budgetMin = Math.max(60, (input.endAt.getTime() - input.startAt.getTime()) / 60000);
  const wantLunch = budgetMin >= 240;
  const base = input.startAt.getTime();
  const at = (m: number) => new Date(base + m * 60000);
  const clockOf = (m: number) => {
    const d = at(m);
    return d.getHours() + d.getMinutes() / 60;
  };
  /** Minutes to add to reach the next day's start time. */
  const toNextMorning = (m: number) => {
    const d = at(m);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    next.setHours(DAY_START, 0, 0, 0);
    return Math.round((next.getTime() - d.getTime()) / 60000);
  };

  const candidates = SITES.filter((s) => {
    if (interestMatch(s, input.interests) === 0) return false;
    if (input.accessible && s.accessibility.level === "difficult") return false;
    return legBetween(start, s, input.mode).minutes + 30 < budgetMin;
  });

  const value = (s: Site, pct: number) => {
    let v = 40 + interestMatch(s, input.interests) * 18 + (s.unesco ? 25 : 0) + s.crowdBase * 0.15;
    if (s.crowdBase >= 80) v += 40; // flagship icons stay in the plan — just at a calmer hour
    if (input.accessible && s.accessibility.level === "partial") v -= 12;
    if (smart) {
      if (s.lesserKnown) v += 14;
      // Non-linear: "packed" hurts far more than "busy".
      if (input.avoidCrowds) v -= Math.max(0, pct - 35) * 0.55 + Math.max(0, pct - 75) * 1.3;
    }
    return v;
  };

  const BEAM = 160;
  let frontier: Node[] = [{ seq: [], pos: start, time: 0, score: 0, lunchDay: "", used: new Set() }];
  let best: Node = frontier[0];

  for (let depth = 0; depth < SITES.length && frontier.length; depth++) {
    const next: Node[] = [];
    for (const n of frontier) {
      for (const s of candidates) {
        if (n.used.has(s.id)) continue;
        const leg = legBetween(n.pos, s, input.mode);
        let t = n.time + leg.minutes;
        let overnight = false;
        const minStay = Math.min(45, s.visitMinutes);
        const fitsToday = (m: number) => clockOf(m) < LAST_ENTRY && (CLOSE - clockOf(m)) * 60 >= minStay;
        if (clockOf(t) < OPEN) t += Math.round((OPEN - clockOf(t)) * 60);
        if (!fitsToday(t)) {
          t += toNextMorning(t); // too late today: stay the night nearby, visit next morning
          overnight = true;
        }
        let lunch = false;
        let lunchDay = n.lunchDay;
        if (wantLunch && clockOf(t) >= 12.75 && lunchDay !== dayKey(at(t))) {
          t += 45;
          lunch = true;
          lunchDay = dayKey(at(t));
        }
        if (!fitsToday(t)) continue;
        // Never stay past closing time.
        const stay = Math.min(s.visitMinutes, 150, Math.floor((CLOSE - clockOf(t)) * 60));
        const dep = t + stay;
        if (dep > budgetMin) continue;
        const pct = crowd(s, at(t));
        const score = n.score + value(s, pct) - leg.minutes * 0.12 - (overnight ? 12 : 0);
        const used = new Set(n.used);
        used.add(s.id);
        next.push({
          seq: [...n.seq, { site: s, arrive: t, depart: dep, pct, lunch, overnight, leg }],
          pos: s,
          time: dep,
          score,
          lunchDay,
          used,
        });
      }
    }
    // keep the best node per (visited set, last site) for diversity, then top BEAM
    const dedup = new Map<string, Node>();
    for (const n of next) {
      const k = [...n.used].sort().join(",") + "|" + n.seq[n.seq.length - 1].site.id;
      const cur = dedup.get(k);
      if (!cur || cur.score < n.score) dedup.set(k, n);
    }
    frontier = [...dedup.values()].sort((a, b) => b.score - a.score).slice(0, BEAM);
    if (frontier[0] && frontier[0].score > best.score) best = frontier[0];
  }
  return { best, at };
}

function artisanPool(input: PlanInput) {
  // Registered, verified businesses first, then the sample listings.
  return [...(input.artisans ?? []), ...(input.builtins ?? SAMPLE_ARTISANS)];
}

function near(a: Artisan, site: Site, km: number) {
  if (a.nearSite === site.id) return true;
  if (!a.lat && !a.lng) return false;
  return haversineKm(a, site) < km;
}

function pickArtisan(pool: Artisan[], site: Site, interests: Interest[], lunch: boolean, taken: Set<string>) {
  const nearby = pool.filter((a) => !taken.has(a.id) && a.category !== "homestay" && near(a, site, 5));
  const prefer = lunch
    ? ["food"]
    : interests.includes("crafts")
      ? ["weaving", "crafts", "food", "other"]
      : ["crafts", "weaving", "food", "guide", "other"];
  for (const cat of prefer) {
    const a = nearby.find((x) => x.category === cat);
    if (a) return a;
  }
  return undefined;
}

function pickStay(pool: Artisan[], site: Site, taken: Set<string>) {
  return pool.find((a) => !taken.has(a.id) && a.category === "homestay" && near(a, site, 20));
}

export function buildPlan(input: PlanInput, crowd: CrowdFn): Plan | null {
  const smart = search(input, crowd, true);
  if (!smart.best.seq.length) return null;
  const naive = search({ ...input, avoidCrowds: false }, crowd, false);
  const { at } = smart;
  const startDay = new Date(input.startAt);
  startDay.setHours(0, 0, 0, 0);
  const dayOf = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return Math.round((x.getTime() - startDay.getTime()) / 86400000) + 1;
  };

  const pool = artisanPool(input);
  const taken = new Set<string>();
  const stops: Stop[] = smart.best.seq.map((x) => {
    const artisan = pickArtisan(pool, x.site, input.interests, x.lunch, taken);
    if (artisan) taken.add(artisan.id);
    const stay = x.overnight ? pickStay(pool, x.site, taken) : undefined;
    if (stay) taken.add(stay.id);
    const arrive = at(x.arrive);
    return {
      site: x.site,
      arrive,
      depart: at(x.depart),
      day: dayOf(arrive),
      pct: x.pct,
      level: levelOf(x.pct),
      leg: x.leg,
      lunchBefore: x.lunch,
      overnightBefore: x.overnight,
      artisan,
      stay,
    };
  });

  const totalKm = +stops.reduce((a, s) => a + s.leg.km, 0).toFixed(1);
  const driveMinutes = stops.reduce((a, s) => a + (s.leg.walk ? 0 : s.leg.minutes), 0);
  const roadKm = stops.reduce((a, s) => a + (s.leg.walk ? 0 : s.leg.km), 0);
  const fees = stops.reduce((a, s) => a + (s.site.entryFeeINR || 0), 0);
  const lunches = stops.filter((s) => s.lunchBefore).length * 150;
  const nights = stops.filter((s) => s.overnightBefore).length;
  const stays = nights * 700; // approx. homestay share per person per night
  const people = Math.max(1, input.people);
  const transport =
    input.mode === "car"
      ? (roadKm * 12 * Math.ceil(people / 5)) / people
      : input.mode === "bus"
        ? roadKm * 1.3
        : (roadKm * 9 * Math.ceil(people / 3)) / people;
  const costPerPerson = Math.round((fees + lunches + stays + transport) / 10) * 10;

  const co2Car = roadKm * 0.171 * Math.ceil(people / 5);
  const co2Bus = roadKm * 0.027 * people;
  const co2Bike = roadKm * 0.06 * Math.ceil(people / 2);
  const co2Kg = +(input.mode === "car" ? co2Car : input.mode === "bus" ? co2Bus : co2Bike).toFixed(1);

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const avgPct = avg(stops.map((s) => s.pct));
  const naiveAvgPct = avg(naive.best.seq.map((s) => s.pct));

  // Explain the difference vs. a typical tourist's day.
  const reroutes: Reroute[] = [];
  for (const n of naive.best.seq) {
    const s = smart.best.seq.find((x) => x.site.id === n.site.id);
    if (s && n.pct - s.pct >= 12) {
      reroutes.push({ kind: "shift", siteId: s.site.id, fromTime: at(n.arrive), fromPct: n.pct, toTime: at(s.arrive), toPct: s.pct });
    }
  }
  const gems = smart.best.seq.filter((x) => x.site.lesserKnown && !naive.best.used.has(x.site.id));
  for (const n of naive.best.seq) {
    if (smart.best.used.has(n.site.id) || n.pct < 62) continue;
    const g = gems.shift();
    if (!g) break;
    reroutes.push({ kind: "swap", siteId: g.site.id, toTime: at(g.arrive), toPct: g.pct, replacedId: n.site.id, replacedPct: n.pct });
  }

  const endAt = stops[stops.length - 1].depart;
  return {
    stops,
    totalKm,
    driveMinutes,
    endAt,
    days: dayOf(endAt),
    nights,
    costPerPerson,
    co2Kg,
    co2BusKg: +co2Bus.toFixed(1),
    co2CarKg: +co2Car.toFixed(1),
    avgPct,
    naiveAvgPct,
    reroutes: reroutes.slice(0, 3),
    overBudget: costPerPerson > input.budget,
    start: input.start,
  };
}

/* ---------------- Google Maps ---------------- */

const travelMode = (mode: Mode) => (mode === "bus" ? "transit" : mode === "bike" ? "two-wheeler" : "driving");

/**
 * Turn-by-turn navigation from the traveller's CURRENT location through every planned
 * stop in order. Leaving out the origin + dir_action=navigate makes Google Maps open
 * straight into navigation (with an origin it only shows a preview).
 * Transit does not support waypoints, so bus trips navigate stop by stop.
 */
export function navigateUrl(stops: Stop[], mode: Mode) {
  if (!stops.length) return "#";
  const tm = travelMode(mode);
  if (mode === "bus") {
    const s = stops[0].site;
    return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=${tm}&dir_action=navigate`;
  }
  const dest = stops[stops.length - 1].site;
  const way = stops
    .slice(0, -1)
    .slice(0, 9)
    .map((s) => `${s.site.lat},${s.site.lng}`)
    .join("|");
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${
    way ? `&waypoints=${encodeURIComponent(way)}` : ""
  }&travelmode=${tm}&dir_action=navigate`;
}

/** Navigate to a single stop from the current location. */
export function stopNavigateUrl(site: { lat: number; lng: number }, mode: Mode) {
  return `https://www.google.com/maps/dir/?api=1&destination=${site.lat},${site.lng}&travelmode=${travelMode(mode)}&dir_action=navigate`;
}

/** Full route preview from the chosen starting point (for planning ahead). */
export function previewUrl(start: StartPoint, stops: Stop[], mode: Mode) {
  if (!stops.length) return "#";
  const dest = stops[stops.length - 1].site;
  const way = mode === "bus" ? "" : stops.slice(0, -1).slice(0, 9).map((s) => `${s.site.lat},${s.site.lng}`).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${dest.lat},${dest.lng}${
    way ? `&waypoints=${encodeURIComponent(way)}` : ""
  }&travelmode=${travelMode(mode)}`;
}
