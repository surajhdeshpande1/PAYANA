"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Accessibility,
  ArrowRight,
  BadgeCheck,
  Bike,
  Bus,
  CalendarClock,
  Car,
  Footprints,
  Gem,
  Leaf,
  Map as MapIcon,
  Minus,
  Moon,
  Navigation,
  Pencil,
  Plus,
  Sparkles,
  TrendingDown,
  TriangleAlert,
  Users,
  Utensils,
  Wallet,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { getSite, photo, sitePhoto } from "@/lib/sites";
import { LEVEL_COLOR, fmtTime, nextSundayNoon } from "@/lib/crowd";
import {
  INTERESTS,
  QUICK_STARTS,
  buildPlan,
  navigateUrl,
  previewUrl,
  stopNavigateUrl,
  type Interest,
  type Mode,
  type Plan,
  type StartPoint,
} from "@/lib/planner";
import { fetchApprovedArtisans, useBuiltinArtisans } from "@/lib/registrations";
import { newPlanId, track } from "@/lib/analytics";
import { DEMO_STEPS } from "@/lib/demo";
import { CrowdBadge, TopBar } from "@/components/ui";
import PlaceSearch from "@/components/PlaceSearch";
import type { Artisan } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="shimmer h-[260px] rounded-2xl" />,
});

const pad = (n: number) => `${n}`.padStart(2, "0");
/** Date → value for <input type="datetime-local"> (local time). */
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fromInput = (s: string) => (s ? new Date(s) : new Date(NaN));

function defaultRange(sunday: boolean) {
  const now = new Date();
  let start: Date;
  if (sunday) start = nextSundayNoon(now);
  else if (now.getHours() >= 6 && now.getHours() < 15) {
    start = new Date(now);
    start.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  } else {
    start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setHours(8, 0, 0, 0);
  }
  const end = new Date(start.getTime() + 8 * 3600_000);
  const sameDayEnd = new Date(start);
  sameDayEnd.setHours(19, 0, 0, 0);
  const finalEnd = end > sameDayEnd && sameDayEnd.getTime() - start.getTime() >= 3 * 3600_000 ? sameDayEnd : end;
  return { start, end: sunday ? new Date(start.getTime() + 6 * 3600_000) : finalEnd };
}

export default function TripPage() {
  const { t, lang, crowd, a11y, timeMode, demoStep } = useApp();
  const [start, setStart] = useState<StartPoint>(QUICK_STARTS[0]);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [budget, setBudget] = useState(1500);
  const [people, setPeople] = useState(2);
  const [interests, setInterests] = useState<Interest[]>(["temples", "history", "crafts"]);
  const [mode, setMode] = useState<Mode>("car");
  const [avoid, setAvoid] = useState(true);
  const [accessible, setAccessible] = useState(false);
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [road, setRoad] = useState<[number, number][] | null>(null);
  const [registered, setRegistered] = useState<Artisan[]>([]);
  const [rangeErr, setRangeErr] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const builtins = useBuiltinArtisans();
  const demoRan = useRef(false);

  useEffect(() => {
    const r = defaultRange(timeMode === "sunday");
    setStartAt(toInput(r.start));
    setEndAt(toInput(r.end));
    setAccessible(a11y);
  }, [timeMode, a11y]);

  // Verified artisans registered through the app are recommended along the route.
  useEffect(() => {
    fetchApprovedArtisans()
      .then((list) => setRegistered(list.filter((a) => a.lat || a.lng)))
      .catch(() => {});
  }, []);

  const s0 = fromInput(startAt);
  const s1 = fromInput(endAt);
  const minutes = (s1.getTime() - s0.getTime()) / 60000;
  const durationLabel = Number.isFinite(minutes) && minutes > 0
    ? minutes >= 1440
      ? `${Math.floor(minutes / 1440)} ${t("trip.days")} ${Math.round((minutes % 1440) / 60)} ${t("trip.hrs")}`
      : `${Math.round(minutes / 60)} ${t("trip.hrs")}`
    : "—";

  const planIdRef = useRef<string | null>(null);
  const trackNavigate = (target: "route" | "stop", siteId?: string) =>
    track("navigate", { siteId: siteId ?? null, lang, meta: { plan_id: planIdRef.current, target, mode, stops: plan?.stops.length ?? 0 } });

  function build(opts?: Partial<{ start: StartPoint; startAt: Date; endAt: Date; people: number; interests: Interest[]; mode: Mode; avoid: boolean; budget: number }>) {
    const a = opts?.startAt ?? s0;
    const b = opts?.endAt ?? s1;
    const span = (b.getTime() - a.getTime()) / 60000;
    if (!Number.isFinite(span) || span < 60 || span > 7 * 1440) {
      setRangeErr(true);
      return;
    }
    setRangeErr(false);
    const input = {
      start: opts?.start ?? start,
      startAt: a,
      endAt: b,
      budget: opts?.budget ?? budget,
      people: opts?.people ?? people,
      interests: opts?.interests ?? interests,
      mode: opts?.mode ?? mode,
      avoidCrowds: opts?.avoid ?? avoid,
      accessible,
      artisans: registered,
      builtins,
    };
    const p = buildPlan(input, (s, at) => crowd(s, at).pct);
    setPlan(p);
    setRoad(null);
    if (p) {
      const planId = newPlanId();
      planIdRef.current = planId;
      track("plan", { lang, meta: { plan_id: planId, stops: p.stops.length, hours: Math.round(span / 60), days: p.days, mode: input.mode, people: input.people } });
      for (const r of p.reroutes) {
        track("reroute", {
          siteId: r.siteId,
          lang,
          meta: {
            plan_id: planId,
            kind: r.kind,
            from: r.replacedId ?? null,
            from_pct: r.kind === "swap" ? r.replacedPct : r.fromPct,
            to_pct: r.toPct,
            people: input.people,
          },
        });
      }
    }
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  // Demo tour (hidden ?demo=1): the Hubballi family's Sunday at Badami.
  useEffect(() => {
    if (demoStep === null || demoRan.current || DEMO_STEPS[demoStep]?.id !== "trip") return;
    demoRan.current = true;
    const a = nextSundayNoon(new Date());
    const b = new Date(a.getTime() + 6 * 3600_000);
    const d = { start: QUICK_STARTS[0], startAt: a, endAt: b, people: 4, interests: ["temples", "history", "crafts"] as Interest[], mode: "car" as Mode, avoid: true, budget: 1500 };
    setStart(d.start);
    setStartAt(toInput(a));
    setEndAt(toInput(b));
    setPeople(d.people);
    setInterests(d.interests);
    setMode(d.mode);
    setAvoid(true);
    build(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoStep]);

  // Real road geometry from the free OSRM router (falls back to straight lines).
  useEffect(() => {
    if (!plan) return;
    const pts = [plan.start, ...plan.stops.map((s) => s.site)];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${pts.map((p) => `${p.lng},${p.lat}`).join(";")}?overview=simplified&geometries=geojson`,
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((j) => {
        const coords = j?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
        if (coords?.length) setRoad(coords.map(([lng, lat]) => [lat, lng]));
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => ctrl.abort();
  }, [plan]);

  const points = useMemo(
    () =>
      plan
        ? plan.stops.map((s, i) => ({
            id: s.site.id,
            lat: s.site.lat,
            lng: s.site.lng,
            color: LEVEL_COLOR[s.level],
            label: String(i + 1),
            title: `${i + 1}. ${s.site.name[lang]}`,
            subtitle: `${fmtTime(s.arrive)} · ${t(`crowd.${s.level}`)} ${s.pct}%`,
          }))
        : [],
    [plan, lang, t],
  );
  const straight = plan ? ([plan.start, ...plan.stops.map((s) => s.site)].map((p) => [p.lat, p.lng]) as [number, number][]) : [];
  const fmtDay = (d: Date) => d.toLocaleDateString(lang === "en" ? "en-IN" : lang === "kn" ? "kn-IN" : "hi-IN", { weekday: "short", day: "numeric", month: "short" });

  const toggleInterest = (i: Interest) =>
    setInterests((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));

  const modeIcon = { car: Car, bus: Bus, bike: Bike };
  const artisanImg = (a: Artisan) => a.photoUrl || photo(a.image).src;

  return (
    <div className="pb-nav">
      <TopBar title={t("trip.title")} back={false} />

      {/* Form */}
      <section className="space-y-5 px-4 pt-4">
        <p className="text-sm text-sand">{t("trip.sub")}</p>

        <div>
          <span className="label">{t("trip.start")}</span>
          <PlaceSearch value={start} onChange={setStart} />
        </div>

        <div className="card space-y-3 p-4">
          <label className="block">
            <span className="label flex items-center gap-1">
              <CalendarClock size={12} /> {t("trip.startAt")}
            </span>
            <input type="datetime-local" className="input [color-scheme:dark]" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </label>
          <label className="block">
            <span className="label flex items-center gap-1">
              <CalendarClock size={12} /> {t("trip.endAt")}
            </span>
            <input type="datetime-local" className="input [color-scheme:dark]" value={endAt} min={startAt} onChange={(e) => setEndAt(e.target.value)} />
          </label>
          <p className="flex items-center justify-between text-xs">
            <span className="text-muted">{t("trip.duration")}</span>
            <b className="text-gold">{durationLabel}</b>
          </p>
          {rangeErr && <p className="text-xs text-packed">{t("trip.badRange")}</p>}
        </div>

        <div className="card space-y-4 p-4">
          <div>
            <div className="flex justify-between">
              <span className="label flex items-center gap-1">
                <Wallet size={12} /> {t("trip.budget")}
              </span>
              <span className="text-sm font-bold text-gold">₹{budget.toLocaleString("en-IN")}</span>
            </div>
            <input type="range" min={300} max={20000} step={100} value={budget} onChange={(e) => setBudget(+e.target.value)} className="w-full accent-[#d9b36c]" />
          </div>
          <div className="flex items-center justify-between">
            <span className="label mb-0 flex items-center gap-1">
              <Users size={12} /> {t("trip.people")}
            </span>
            <div className="flex items-center gap-3">
              <button onClick={() => setPeople(Math.max(1, people - 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 text-gold" aria-label="-">
                <Minus size={15} />
              </button>
              <span className="w-5 text-center font-bold">{people}</span>
              <button onClick={() => setPeople(Math.min(20, people + 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 text-gold" aria-label="+">
                <Plus size={15} />
              </button>
            </div>
          </div>
        </div>

        <div>
          <span className="label">{t("trip.interests")}</span>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <button key={i} onClick={() => toggleInterest(i)} className={`chip ${interests.includes(i) ? "chip-on" : ""}`}>
                {t(`int.${i}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">{t("trip.mode")}</span>
          <div className="grid grid-cols-3 gap-2">
            {(["car", "bus", "bike"] as Mode[]).map((m) => {
              const Icon = modeIcon[m];
              return (
                <button key={m} onClick={() => setMode(m)} className={`card flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${mode === m ? "border-gold bg-gold/15 text-gold-light" : "text-sand"}`}>
                  <Icon size={20} /> {t(`mode.${m}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setAvoid(!avoid)} className={`card flex items-center gap-2 px-3 py-3 text-left text-xs font-semibold ${avoid ? "border-teal/70 text-teal" : "text-sand"}`}>
            <TrendingDown size={17} /> {t("trip.avoid")} {avoid ? "✓" : ""}
          </button>
          <button onClick={() => setAccessible(!accessible)} className={`card flex items-center gap-2 px-3 py-3 text-left text-xs font-semibold ${accessible ? "border-teal/70 text-teal" : "text-sand"}`}>
            <Accessibility size={17} /> {t("trip.access")} {accessible ? "✓" : ""}
          </button>
        </div>

        <button onClick={() => build()} className="btn-gold w-full py-4 text-base">
          <Sparkles size={19} /> {t("trip.build")}
        </button>
      </section>

      {/* Result */}
      <div ref={resultRef} className="scroll-mt-16" />
      {plan === null && <p className="mx-4 mt-5 rounded-xl border border-busy/50 bg-busy/10 p-4 text-sm text-cream">{t("trip.none")}</p>}
      {plan && (
        <section className="fade-up mt-6 space-y-4 px-4">
          <div className="divider-ornament text-xs">◆</div>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-gold-light">{t("trip.yourDay")}</h2>
            <p className="text-xs text-muted">
              {plan.start.label} · {fmtDay(plan.stops[0].arrive)} {fmtTime(plan.stops[0].arrive)} – {plan.days > 1 ? `${fmtDay(plan.endAt)} ` : ""}
              {fmtTime(plan.endAt)}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { v: plan.stops.length, l: t("trip.stops") },
              { v: plan.days > 1 ? `${plan.days}` : plan.totalKm, l: plan.days > 1 ? t("trip.days") : t("trip.km") },
              { v: `₹${plan.costPerPerson.toLocaleString("en-IN")}`, l: plan.nights ? `${t("trip.cost")} · ${t("trip.inclStays")}` : t("trip.cost") },
              { v: `${plan.co2Kg}kg`, l: t("trip.co2") },
            ].map((x) => (
              <div key={x.l} className="card px-1 py-2.5">
                <p className="text-base font-bold text-cream">{x.v}</p>
                <p className="text-[9px] leading-tight text-muted">{x.l}</p>
              </div>
            ))}
          </div>

          {/* Start the journey — real turn-by-turn navigation through the planned stops */}
          <a href={navigateUrl(plan.stops, mode)} target="_blank" rel="noreferrer" className="btn-gold w-full flex-col gap-0.5 py-3.5" onClick={() => trackNavigate("route")}>
            <span className="flex items-center gap-2 text-base">
              <Navigation size={18} fill="currentColor" /> {t("trip.startNav")}
            </span>
            <span className="text-[11px] font-medium opacity-70">
              {mode === "bus" ? t("trip.busNav") : t("trip.startNavSub", { n: plan.stops.length })}
            </span>
          </a>

          {plan.naiveAvgPct - plan.avgPct >= 5 && (
            <div className="flex items-center gap-3 rounded-2xl border border-teal/50 bg-teal/10 p-3">
              <TrendingDown className="shrink-0 text-teal" size={26} />
              <p className="text-sm">
                <b className="text-lg text-teal">−{plan.naiveAvgPct - plan.avgPct}%</b> {t("trip.crowdAvoided")}
                <span className="block text-[11px] text-muted">
                  {plan.naiveAvgPct}% → {plan.avgPct}%
                </span>
              </p>
            </div>
          )}

          {plan.reroutes.length > 0 && (
            <div className="space-y-2">
              {plan.reroutes.map((r, i) => {
                const s = getSite(r.siteId)!;
                return (
                  <div key={i} className="rounded-2xl border border-gold/50 bg-gold/10 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gold">
                      <Sparkles size={12} /> {t("trip.rerouted")}
                    </p>
                    {r.kind === "shift" ? (
                      <p className="text-sm">
                        <b>{s.name[lang]}</b>: <span className="text-packed line-through decoration-2">{fmtTime(r.fromTime!)} · {r.fromPct}%</span>{" "}
                        <ArrowRight size={13} className="inline" />{" "}
                        <span className="font-semibold text-calm">
                          {fmtTime(r.toTime)} · {r.toPct}%
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm">
                        <span className="text-packed line-through decoration-2">
                          {getSite(r.replacedId)?.name[lang]} · {r.replacedPct}%
                        </span>{" "}
                        <ArrowRight size={13} className="inline" />{" "}
                        <b className="text-calm">
                          <Gem size={12} className="inline" /> {s.name[lang]} · {r.toPct}%
                        </b>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {plan.overBudget && (
            <p className="flex items-center gap-2 rounded-xl border border-busy/50 bg-busy/10 p-3 text-xs">
              <TriangleAlert size={16} className="text-busy" /> {t("trip.overBudget")}
            </p>
          )}

          <MapView points={points} route={road ?? straight} height={260} />

          {/* Timeline, grouped by day */}
          <ol className="relative space-y-0">
            {plan.stops.map((s, i) => {
              const newDay = i === 0 || s.day !== plan.stops[i - 1].day;
              return (
                <Fragment key={s.site.id}>
                  {plan.days > 1 && newDay && (
                    <li className="pb-1 pt-3">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-maroon-950">
                        {t("trip.day", { n: s.day })} · {fmtDay(s.arrive)}
                      </span>
                    </li>
                  )}
                  <li className="relative pl-9">
                    <span className="absolute bottom-0 left-[15px] top-0 w-px bg-gold/25" />
                    <div className="flex items-center gap-2 py-2 text-[11px] text-muted">
                      {s.leg.walk ? <Footprints size={13} /> : mode === "bus" ? <Bus size={13} /> : mode === "bike" ? <Bike size={13} /> : <Car size={13} />}
                      {s.leg.minutes >= 90 ? `${Math.floor(s.leg.minutes / 60)} h ${s.leg.minutes % 60}` : s.leg.minutes} {t("trip.min")} · {s.leg.km} {t("trip.km")}
                      {s.leg.walk && ` · ${t("trip.walk")}`}
                    </div>
                    {s.overnightBefore && (
                      <div className="mb-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-sand">
                        <p className="flex items-center gap-2 font-semibold text-white">
                          <Moon size={14} className="text-gold" /> {t("trip.overnight", { town: s.site.town })}
                        </p>
                        {s.stay && (
                          <Link href={s.stay.registered ? "/artisans" : `/artisans#${s.stay.id}`} className="mt-1.5 flex items-center gap-2">
                            <img src={artisanImg(s.stay)} alt="" className="h-8 w-8 rounded-lg object-cover" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[10px] text-teal">{t("trip.stayHere")}</span>
                              <span className="block truncate font-semibold text-cream">{s.stay.name[lang]}</span>
                            </span>
                            <ArrowRight size={14} className="text-gold" />
                          </Link>
                        )}
                      </div>
                    )}
                    {s.lunchBefore && (
                      <div className="mb-2 flex items-center gap-2 rounded-xl bg-maroon-800/60 px-3 py-2 text-xs text-sand">
                        <Utensils size={14} className="text-gold" /> {t("trip.lunch")} · 45 {t("trip.min")}
                      </div>
                    )}
                    <span
                      className="absolute left-0 mt-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-maroon-950 text-sm font-bold text-maroon-950"
                      style={{ background: LEVEL_COLOR[s.level] }}
                    >
                      {i + 1}
                    </span>
                    <div className="card overflow-hidden">
                      <div className="flex gap-3 p-2.5">
                        <Link href={`/site/${s.site.id}`} className="flex min-w-0 flex-1 gap-3">
                          <img src={sitePhoto(s.site.id).src} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-gold">
                              {fmtTime(s.arrive)} – {fmtTime(s.depart)}
                            </p>
                            <p className="truncate font-semibold">{s.site.name[lang]}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <CrowdBadge level={s.level} pct={s.pct} small />
                              {s.site.lesserKnown && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-semibold text-gold">💎 {t("trip.hiddenGem")}</span>}
                            </div>
                          </div>
                        </Link>
                        <a
                          href={stopNavigateUrl(s.site, mode)}
                          onClick={() => trackNavigate("stop", s.site.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex shrink-0 flex-col items-center justify-center gap-0.5 self-center rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-maroon-950"
                          aria-label={`${t("trip.go")}: ${s.site.name[lang]}`}
                        >
                          <Navigation size={15} fill="currentColor" /> {t("trip.go")}
                        </a>
                      </div>
                      {s.artisan && (
                        <Link href={s.artisan.registered ? "/artisans" : `/artisans#${s.artisan.id}`} className="flex items-center gap-2 border-t border-gold/15 bg-maroon-900/50 px-3 py-2">
                          <img src={artisanImg(s.artisan)} alt="" className="h-9 w-9 rounded-lg object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1 text-[10px] text-teal">
                              {s.artisan.registered && <BadgeCheck size={11} />}
                              {s.artisan.registered ? t("trip.registered") : t("trip.artisanStop")}
                            </span>
                            <span className="block truncate text-xs font-semibold">{s.artisan.name[lang]}</span>
                          </span>
                          <ArrowRight size={14} className="text-gold" />
                        </Link>
                      )}
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>

          {/* Greener choice */}
          <div className="card flex items-start gap-3 p-4">
            <Leaf className="mt-0.5 shrink-0 text-calm" size={22} />
            <div className="text-sm">
              <p className="font-semibold text-calm">{t("trip.greener")}</p>
              {mode === "bus" ? (
                <p className="text-sand">
                  🚌 {plan.co2Kg} kg CO₂ vs 🚗 {plan.co2CarKg} kg — <b className="text-calm">{(plan.co2CarKg - plan.co2Kg).toFixed(1)} kg saved</b>
                </p>
              ) : (
                <p className="text-sand">
                  {mode === "car" ? "🚗" : "🛵"} {plan.co2Kg} kg CO₂ → 🚌 KSRTC bus {plan.co2BusKg} kg <b className="text-calm">(−{Math.max(0, plan.co2Kg - plan.co2BusKg).toFixed(1)} kg)</b>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <a href={navigateUrl(plan.stops, mode)} target="_blank" rel="noreferrer" className="btn-gold" onClick={() => trackNavigate("route")}>
              <Navigation size={17} fill="currentColor" /> {t("trip.startNav")}
            </a>
            <a href={previewUrl(plan.start, plan.stops, mode)} target="_blank" rel="noreferrer" className="btn-ghost">
              <MapIcon size={16} /> {t("trip.viewRoute", { start: plan.start.label })}
            </a>
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="btn-ghost">
              <Pencil size={15} /> {t("trip.edit")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
