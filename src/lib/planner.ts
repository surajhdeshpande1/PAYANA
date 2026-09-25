import { SAMPLE_ARTISANS, TOWN_COORDS } from "./artisans";
import { levelOf, type CrowdLevel } from "./crowd";
import { SITES, haversineKm } from "./sites";
import type { Artisan, Site, SiteCategory } from "./types";

export type Interest = "temples" | "history" | "nature" | "crafts" | "spiritual";
export type Mode = "car" | "bus" | "bike";

export const INTERESTS: Interest[] = ["temples", "history", "nature", "crafts", "spiritual"];
export const START_POINTS = ["badami", "bagalkote", "aihole", "pattadakal", "ilkal", "hubballi", "vijayapura"] as const;
export const START_LABEL: Record<string, string> = {
  badami: "Badami",
  bagalkote: "Bagalkote",
  aihole: "Aihole",
  pattadakal: "Pattadakal",
  ilkal: "Ilkal",
  hubballi: "Hubballi",
  vijayapura: "Vijayapura",
};

const INTEREST_CATS: Record<Interest, SiteCategory[]> = {
  temples: ["temple", "cave", "architecture"],
  history: ["fort", "architecture", "cave"],
  nature: ["nature", "lake"],
  crafts: ["crafts"],
  spiritual: ["spiritual", "temple"],
};

export interface PlanInput {
  start: string;
  startAt: Date;
  hours: number;
  budget: number;
  people: number;
  interests: Interest[];
  mode: Mode;
  avoidCrowds: boolean;
  accessible: boolean;
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
  pct: number;
  level: CrowdLevel;
  leg: Leg;
  lunchBefore: boolean;
  artisan?: Artisan;
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
  costPerPerson: number;
  co2Kg: number;
  co2BusKg: number;
  co2CarKg: number;
  avgPct: number;
  naiveAvgPct: number;
  reroutes: Reroute[];
  overBudget: boolean;
  startCoord: { lat: number; lng: number };
}

type CrowdFn = (site: Site, at: Date) => number;

export function legBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }, mode: Mode): Leg {
  const d = haversineKm(a, b);
  if (d < 1.3) {
    return { km: +(d * 1.25).toFixed(1), minutes: Math.round((d * 1.25) / 4.2 * 60) + 3, walk: true };
  }
  const km = d * 1.3;
  const speed = mode === "car" ? 42 : mode === "bike" ? 36 : 30;
  const overhead = mode === "bus" ? 12 : 4;
  return { km: +km.toFixed(1), minutes: Math.round((km / speed) * 60) + overhead, walk: false };
}

function interestMatch(site: Site, interests: Interest[]) {
  if (!interests.length) return 1;
  return interests.filter((i) => INTEREST_CATS[i].some((c) => site.category.includes(c))).length;
}

interface Node {
  seq: { site: Site; arrive: number; depart: number; pct: number; lunch: boolean; leg: Leg }[];
  pos: { lat: number; lng: number };
  time: number; // minutes after startAt
  score: number;
  lunch: boolean;
  used: Set<string>;
}

function search(input: PlanInput, crowd: CrowdFn, smart: boolean) {
  const startCoord = TOWN_COORDS[input.start] ?? TOWN_COORDS.badami;
  const budgetMin = input.hours * 60;
  const wantLunch = input.hours >= 4;
  const base = input.startAt.getTime();
  const at = (m: number) => new Date(base + m * 60000);

  const candidates = SITES.filter((s) => {
    if (interestMatch(s, input.interests) === 0) return false;
    if (input.accessible && s.accessibility.level === "difficult") return false;
    return legBetween(startCoord, s, input.mode).minutes < budgetMin * 0.7;
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
  let frontier: Node[] = [{ seq: [], pos: startCoord, time: 0, score: 0, lunch: false, used: new Set() }];
  let best: Node = frontier[0];

  for (let depth = 0; depth < 9 && frontier.length; depth++) {
    const next: Node[] = [];
    for (const n of frontier) {
      for (const s of candidates) {
        if (n.used.has(s.id)) continue;
        const leg = legBetween(n.pos, s, input.mode);
        let t = n.time + leg.minutes;
        let lunch = false;
        const clock = () => {
          const d = at(t);
          return d.getHours() + d.getMinutes() / 60;
        };
        if (wantLunch && !n.lunch && clock() >= 12.75) {
          t += 45;
          lunch = true;
        }
        if (clock() < 6) t += Math.round((6 - clock()) * 60);
        if (clock() >= 17.75) continue; // too late to enter
        const stay = Math.min(s.visitMinutes, 150);
        const dep = t + stay;
        if (dep > budgetMin) continue;
        const pct = crowd(s, at(t));
        const score = n.score + value(s, pct) - leg.minutes * 0.12;
        const used = new Set(n.used);
        used.add(s.id);
        next.push({
          seq: [...n.seq, { site: s, arrive: t, depart: dep, pct, lunch, leg }],
          pos: s,
          time: dep,
          score,
          lunch: n.lunch || lunch,
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
  return { best, startCoord, at };
}

function pickArtisan(site: Site, interests: Interest[], lunch: boolean, taken: Set<string>) {
  const near = SAMPLE_ARTISANS.filter(
    (a) => !taken.has(a.id) && (a.nearSite === site.id || haversineKm(a, site) < 4),
  );
  const prefer = lunch
    ? ["food"]
    : interests.includes("crafts")
      ? ["weaving", "crafts", "food"]
      : ["crafts", "weaving", "food", "guide"];
  for (const cat of prefer) {
    const a = near.find((x) => x.category === cat);
    if (a) return a;
  }
  return undefined;
}

export function buildPlan(input: PlanInput, crowd: CrowdFn): Plan | null {
  const smart = search(input, crowd, true);
  if (!smart.best.seq.length) return null;
  const naive = search({ ...input, avoidCrowds: false }, crowd, false);
  const { at, startCoord } = smart;

  const taken = new Set<string>();
  const stops: Stop[] = smart.best.seq.map((x) => {
    const artisan = pickArtisan(x.site, input.interests, x.lunch, taken);
    if (artisan) taken.add(artisan.id);
    return {
      site: x.site,
      arrive: at(x.arrive),
      depart: at(x.depart),
      pct: x.pct,
      level: levelOf(x.pct),
      leg: x.leg,
      lunchBefore: x.lunch,
      artisan,
    };
  });

  const totalKm = +stops.reduce((a, s) => a + s.leg.km, 0).toFixed(1);
  const driveMinutes = stops.reduce((a, s) => a + (s.leg.walk ? 0 : s.leg.minutes), 0);
  const roadKm = stops.reduce((a, s) => a + (s.leg.walk ? 0 : s.leg.km), 0);
  const fees = stops.reduce((a, s) => a + (s.site.entryFeeINR || 0), 0);
  const lunch = stops.some((s) => s.lunchBefore) ? 150 : 0;
  const people = Math.max(1, input.people);
  const transport =
    input.mode === "car"
      ? (roadKm * 12 * Math.ceil(people / 5)) / people
      : input.mode === "bus"
        ? roadKm * 1.3
        : (roadKm * 9 * Math.ceil(people / 3)) / people;
  const costPerPerson = Math.round((fees + lunch + transport) / 10) * 10;

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
      reroutes.push({
        kind: "shift",
        siteId: s.site.id,
        fromTime: at(n.arrive),
        fromPct: n.pct,
        toTime: at(s.arrive),
        toPct: s.pct,
      });
    }
  }
  const gems = smart.best.seq.filter((x) => x.site.lesserKnown && !naive.best.used.has(x.site.id));
  for (const n of naive.best.seq) {
    if (smart.best.used.has(n.site.id) || n.pct < 62) continue;
    const g = gems.shift();
    if (!g) break;
    reroutes.push({
      kind: "swap",
      siteId: g.site.id,
      toTime: at(g.arrive),
      toPct: g.pct,
      replacedId: n.site.id,
      replacedPct: n.pct,
    });
  }

  return {
    stops,
    totalKm,
    driveMinutes,
    endAt: stops[stops.length - 1].depart,
    costPerPerson,
    co2Kg,
    co2BusKg: +co2Bus.toFixed(1),
    co2CarKg: +co2Car.toFixed(1),
    avgPct,
    naiveAvgPct,
    reroutes: reroutes.slice(0, 3),
    overBudget: costPerPerson > input.budget,
    startCoord,
  };
}

export function googleMapsRoute(start: { lat: number; lng: number }, stops: Stop[], mode: Mode) {
  if (!stops.length) return "#";
  const dest = stops[stops.length - 1].site;
  const way = stops
    .slice(0, -1)
    .slice(0, 8)
    .map((s) => `${s.site.lat},${s.site.lng}`)
    .join("|");
  const tm = mode === "bus" ? "transit" : mode === "bike" ? "two-wheeler" : "driving";
  return `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${dest.lat},${dest.lng}${
    way ? `&waypoints=${encodeURIComponent(way)}` : ""
  }&travelmode=${tm}`;
}
