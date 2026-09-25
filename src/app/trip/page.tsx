"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accessibility,
  ArrowRight,
  Bike,
  Bus,
  Car,
  Clock,
  Footprints,
  Gem,
  Leaf,
  Minus,
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
import { INTERESTS, START_LABEL, START_POINTS, buildPlan, googleMapsRoute, type Interest, type Mode, type Plan } from "@/lib/planner";
import { track } from "@/lib/analytics";
import { DEMO_STEPS } from "@/lib/demo";
import { CrowdBadge, TopBar } from "@/components/ui";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="shimmer h-[260px] rounded-2xl" />,
});

type When = "now" | "tomorrow" | "sunday";

function startDate(w: When) {
  const now = new Date();
  if (w === "now") return now;
  if (w === "sunday") return nextSundayNoon(now);
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}

export default function TripPage() {
  const { t, lang, crowd, a11y, timeMode, demoStep } = useApp();
  const [start, setStart] = useState<string>("badami");
  const [when, setWhen] = useState<When>("now");
  const [hours, setHours] = useState(6);
  const [budget, setBudget] = useState(1500);
  const [people, setPeople] = useState(2);
  const [interests, setInterests] = useState<Interest[]>(["temples", "history", "crafts"]);
  const [mode, setMode] = useState<Mode>("car");
  const [avoid, setAvoid] = useState(true);
  const [accessible, setAccessible] = useState(false);
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [road, setRoad] = useState<[number, number][] | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const demoRan = useRef(false);

  useEffect(() => {
    const h = new Date().getHours();
    setWhen(timeMode === "sunday" ? "sunday" : h >= 6 && h < 15 ? "now" : "tomorrow");
    setAccessible(a11y);
  }, [timeMode, a11y]);

  function build(opts?: Partial<{ start: string; when: When; hours: number; people: number; interests: Interest[]; mode: Mode; avoid: boolean; budget: number }>) {
    const input = {
      start: opts?.start ?? start,
      startAt: startDate(opts?.when ?? when),
      hours: opts?.hours ?? hours,
      budget: opts?.budget ?? budget,
      people: opts?.people ?? people,
      interests: opts?.interests ?? interests,
      mode: opts?.mode ?? mode,
      avoidCrowds: opts?.avoid ?? avoid,
      accessible,
    };
    const p = buildPlan(input, (s, at) => crowd(s, at).pct);
    setPlan(p);
    setRoad(null);
    if (p) {
      track("plan", { lang, meta: { stops: p.stops.length, hours: input.hours, mode: input.mode, people: input.people } });
      for (const r of p.reroutes) {
        track("reroute", { siteId: r.siteId, lang, meta: { kind: r.kind, from: r.replacedId ?? null, people: input.people } });
      }
    }
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  // Demo tour: the Hubballi family's Sunday at Badami.
  useEffect(() => {
    if (demoStep === null || demoRan.current || DEMO_STEPS[demoStep]?.id !== "trip") return;
    demoRan.current = true;
    const d = { start: "badami", when: "sunday" as When, hours: 6, people: 4, interests: ["temples", "history", "crafts"] as Interest[], mode: "car" as Mode, avoid: true, budget: 1500 };
    setStart(d.start);
    setWhen(d.when);
    setHours(d.hours);
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
    const pts = [plan.startCoord, ...plan.stops.map((s) => s.site)];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
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
  const straight = plan ? ([plan.startCoord, ...plan.stops.map((s) => s.site)].map((p) => [p.lat, p.lng]) as [number, number][]) : [];

  const toggleInterest = (i: Interest) =>
    setInterests((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));

  const modeIcon = { car: Car, bus: Bus, bike: Bike };
  const whenLabel: Record<When, string> = {
    now: t("time.now"),
    tomorrow: lang === "kn" ? "ನಾಳೆ ಬೆಳಿಗ್ಗೆ 8" : lang === "hi" ? "कल सुबह 8" : "Tomorrow 8 AM",
    sunday: t("time.sunday"),
  };

  return (
    <div className="pb-nav">
      <TopBar title={t("trip.title")} back={false} />

      {/* Form */}
      <section className="space-y-4 px-4 pt-4">
        <p className="text-sm text-sand">{t("trip.sub")}</p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">{t("trip.start")}</span>
            <select value={start} onChange={(e) => setStart(e.target.value)} className="input">
              {START_POINTS.map((p) => (
                <option key={p} value={p}>
                  {START_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t("trip.when")}</span>
            <select value={when} onChange={(e) => setWhen(e.target.value as When)} className="input">
              {(["now", "tomorrow", "sunday"] as When[]).map((w) => (
                <option key={w} value={w}>
                  {whenLabel[w]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="card space-y-4 p-4">
          <div>
            <div className="flex justify-between">
              <span className="label flex items-center gap-1"><Clock size={12} /> {t("trip.hours")}</span>
              <span className="text-sm font-bold text-gold">{hours} {t("trip.hrs")}</span>
            </div>
            <input type="range" min={2} max={11} value={hours} onChange={(e) => setHours(+e.target.value)} className="w-full accent-[#e8b45a]" />
          </div>
          <div>
            <div className="flex justify-between">
              <span className="label flex items-center gap-1"><Wallet size={12} /> {t("trip.budget")}</span>
              <span className="text-sm font-bold text-gold">₹{budget.toLocaleString("en-IN")}</span>
            </div>
            <input type="range" min={300} max={5000} step={100} value={budget} onChange={(e) => setBudget(+e.target.value)} className="w-full accent-[#e8b45a]" />
          </div>
          <div className="flex items-center justify-between">
            <span className="label mb-0 flex items-center gap-1"><Users size={12} /> {t("trip.people")}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setPeople(Math.max(1, people - 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 text-gold" aria-label="-">
                <Minus size={15} />
              </button>
              <span className="w-5 text-center font-bold">{people}</span>
              <button onClick={() => setPeople(Math.min(12, people + 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 text-gold" aria-label="+">
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
      {plan === null && (
        <p className="mx-4 mt-5 rounded-xl border border-busy/50 bg-busy/10 p-4 text-sm text-cream">{t("trip.none")}</p>
      )}
      {plan && (
        <section className="fade-up mt-6 space-y-4 px-4">
          <div className="divider-ornament text-xs">◆</div>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-gold-light">{t("trip.yourDay")}</h2>
            <p className="text-xs text-muted">
              {START_LABEL[start]} · {fmtTime(plan.stops[0].arrive)} – {fmtTime(plan.endAt)}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { v: plan.stops.length, l: t("trip.stops") },
              { v: plan.totalKm, l: t("trip.km") },
              { v: `₹${plan.costPerPerson}`, l: t("trip.cost") },
              { v: `${plan.co2Kg}kg`, l: t("trip.co2") },
            ].map((x) => (
              <div key={x.l} className="card px-1 py-2.5">
                <p className="text-base font-bold text-cream">{x.v}</p>
                <p className="text-[9px] leading-tight text-muted">{x.l}</p>
              </div>
            ))}
          </div>

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
                        <b>{s.name[lang]}</b>:{" "}
                        <span className="text-packed line-through decoration-2">
                          {fmtTime(r.fromTime!)} · {r.fromPct}%
                        </span>{" "}
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

          {/* Timeline */}
          <ol className="relative space-y-0">
            {plan.stops.map((s, i) => (
              <li key={s.site.id} className="relative pl-9">
                <span className="absolute bottom-0 left-[15px] top-0 w-px bg-gold/25" />
                {/* leg */}
                <div className="flex items-center gap-2 py-2 text-[11px] text-muted">
                  {s.leg.walk ? <Footprints size={13} /> : mode === "bus" ? <Bus size={13} /> : mode === "bike" ? <Bike size={13} /> : <Car size={13} />}
                  {s.leg.minutes} {t("trip.min")} · {s.leg.km} {t("trip.km")}
                  {s.leg.walk && ` · ${t("trip.walk")}`}
                </div>
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
                  <Link href={`/site/${s.site.id}`} className="flex gap-3 p-2.5">
                    <img src={sitePhoto(s.site.id).src} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-gold">
                        {fmtTime(s.arrive)} – {fmtTime(s.depart)}
                      </p>
                      <p className="truncate font-semibold">{s.site.name[lang]}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <CrowdBadge level={s.level} pct={s.pct} small />
                        {s.site.lesserKnown && (
                          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-semibold text-gold">💎 {t("trip.hiddenGem")}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                  {s.artisan && (
                    <Link href={`/artisans#${s.artisan.id}`} className="flex items-center gap-2 border-t border-gold/15 bg-maroon-900/50 px-3 py-2">
                      <img src={photo(s.artisan.image).src} alt="" className="h-8 w-8 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] text-teal">{t("trip.artisanStop")}</span>
                        <span className="block truncate text-xs font-semibold">{s.artisan.name[lang]}</span>
                      </span>
                      <ArrowRight size={14} className="text-gold" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
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
                  {mode === "car" ? "🚗" : "🛵"} {plan.co2Kg} kg CO₂ → 🚌 KSRTC bus {plan.co2BusKg} kg{" "}
                  <b className="text-calm">(−{Math.max(0, plan.co2Kg - plan.co2BusKg).toFixed(1)} kg)</b>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a href={googleMapsRoute(plan.startCoord, plan.stops, mode)} target="_blank" rel="noreferrer" className="btn-gold col-span-2">
              <Navigation size={17} /> {t("trip.openMaps")}
            </a>
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="btn-ghost col-span-2">
              <Pencil size={15} /> {t("trip.edit")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
