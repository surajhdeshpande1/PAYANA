"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Gem,
  HandHeart,
  KeyRound,
  Loader2,
  Megaphone,
  MessageCircle,
  Printer,
  RefreshCw,
  RotateCcw,
  Route,
  ShieldAlert,
  Stamp,
  Store,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { SAMPLE_ARTISANS } from "@/lib/artisans";
import { SITES, getSite, photo } from "@/lib/sites";
import { mapSearchUrl } from "@/lib/location";
import { LEVEL_COLOR, bestHours, fmtHour, hourlyForecast } from "@/lib/crowd";
import { sbRpc } from "@/lib/supabase";
import { localEventCounts } from "@/lib/analytics";
import { TopBar, ratingColor } from "@/components/ui";

type Counts = Record<string, number>;

interface Stats {
  totals: Counts;
  today: Counts;
  events_total: number;
  events_today: number;
  langs: Counts;
  sites: Counts;
  hourly: { h: string; hour: number; c: number; opens: number; visitors: number }[];
  activity_24h: { events: number; sessions: number; visitors: number; by_type: Counts };
  footfall: {
    plans_built: number;
    trips: number;
    people_planned: number;
    redirected_people: number;
    shifted_people: number;
    rerouted_people: number;
    confirmed_people: number;
    navigated_trips: number;
    to_site: Counts;
    from_site: Counts;
    shifted_site: Counts;
    crowd_from: number | null;
    crowd_to: number | null;
  };
  plans: { avg_stops: number | null; avg_days: number | null; avg_group: number | null; multi_day: number; modes: Counts };
  scans: { total: number; identified: number; providers: Counts };
  sos: { total: number; today: number; lines: Counts; recent: { line: string; created_at: string }[] };
  crowd: {
    recent: { site_id: string; rating: number; created_at: string }[];
    live: Record<string, { avg: number; n: number }>;
    today: number;
    avg_today: number | null;
    total: number;
  };
  passport: { stamps: number; holders: number; by_site: Counts };
  users: { total: number; today: number; week: number; signed_in: number; logins_24h: number };
  artisans: {
    pending: number;
    approved: number;
    rejected: number;
    removed_builtin: string[];
    names: Record<string, string>;
    contacts: Counts;
    contact_how: Counts;
  };
  reach?: { sessions: number; artisan_sessions: number; artisan_pairs: number; plan_sessions: number };
  generated_at: string;
}

interface Reg {
  id: string;
  name: string;
  craft: string;
  category: string;
  town: string;
  phone: string | null;
  description: string | null;
  address: string | null;
  photo_url: string | null;
  lat: number | null;
  lng: number | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface Tourist {
  name: string;
  email: string;
  created_at: string;
  last_login_at: string | null;
  stamps: number;
  active: boolean;
}

const LANG_COLORS: Record<string, string> = { kn: "#e8b45a", hi: "#3fd1b5", en: "#f08a3c" };
const TYPE_LABEL: Record<string, string> = {
  open: "App opens",
  scan: "Scans",
  ask: "Typed questions",
  voice: "Voice questions",
  plan: "Plans built",
  reroute: "Crowd reroutes",
  navigate: "Navigation started",
  artisan_contact: "Artisan contacts",
  stamp: "Passport stamps",
  crowd_report: "Crowd reports",
  register: "Artisan sign-ups",
  demo: "Demo tours",
  sos: "SOS calls",
};

// Annual ticketed footfall at the three ASI monuments (ASI, reported by The Hans India, 2026).
const ASI_VISITS = { badami: 444542, pattadakal: 324615, aihole: 213901 };
const ASI_TOTAL = ASI_VISITS.badami + ASI_VISITS.pattadakal + ASI_VISITS.aihole;

const n = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("en-IN");
const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const lakh = (v: number) => (v >= 100000 ? `${(v / 100000).toFixed(v >= 1000000 ? 1 : 2)} L` : n(Math.round(v)));

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

const hour12 = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;

function Bars({ rows, max, fmt = n }: { rows: [string, number, string?][]; max?: number; fmt?: (v: number) => string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="space-y-2">
      {rows.map(([label, v, color]) => (
        <li key={label}>
          <div className="mb-0.5 flex justify-between gap-2 text-xs">
            <span className="truncate text-sand">{label}</span>
            <b className="shrink-0 text-gold">{fmt(v)}</b>
          </div>
          <div className="h-2 rounded-full bg-maroon-900">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (v / top) * 100)}%`, background: color ?? "linear-gradient(90deg,#a8823f,#d9b36c)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Section({ id, title, icon, sub, children, right }: { id: string; title: string; icon?: React.ReactNode; sub?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section id={id} className="mt-4 scroll-mt-28 px-4">
      <div className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="section-title flex items-center gap-2">
              {icon} {title}
            </h2>
            {sub && <p className="mt-0.5 text-[11px] leading-snug text-muted">{sub}</p>}
          </div>
          {right}
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

function Slider({ label, value, set, min, max, step, fmt, note }: { label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; fmt: (v: number) => string; note?: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-sand">{label}</span>
        <b className="text-gold">{fmt(value)}</b>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} className="w-full accent-[#3fd1b5]" />
      {note && <p className="-mt-0.5 text-[10px] text-muted">{note}</p>}
    </div>
  );
}

export default function AdminPage() {
  const { t, lang, crowd } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [hourSel, setHourSel] = useState<number | null>(null);

  // admin (PIN) tools
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [tourists, setTourists] = useState<Tourist[]>([]);
  const [pinErr, setPinErr] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [showAllTourists, setShowAllTourists] = useState(false);

  // projection inputs
  const [asiVisits, setAsiVisits] = useState(ASI_TOTAL);
  const [sitesPer, setSitesPer] = useState(2);
  const [adoption, setAdoption] = useState(5);
  const [conversion, setConversion] = useState(35);
  const [spend, setSpend] = useState(650);
  const [override, setOverride] = useState<Partial<Record<"reroute" | "gem" | "follow" | "contact" | "group", number>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await sbRpc<Stats>("dashboard_stats");
      setStats(s);
      setOffline(false);
      setLastOk(Date.now());
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, []);

  // Real time: refresh every 5 s while the dashboard is on screen, and on return to it.
  useEffect(() => {
    load();
    const poll = setInterval(() => document.visibilityState === "visible" && load(), 5000);
    const tick = setInterval(() => setClock(Date.now()), 1000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const loadAdmin = useCallback(
    async (p = pin) => {
      setPinErr("");
      try {
        const [r, u] = await Promise.all([sbRpc<Reg[]>("admin_list_artisans", { p_pin: p }), sbRpc<Tourist[]>("admin_list_users", { p_pin: p })]);
        setRegs(r);
        setTourists(u);
        setUnlocked(true);
      } catch {
        setPinErr("Invalid PIN or offline");
        setUnlocked(false);
      }
    },
    [pin],
  );

  // Keep the PIN-protected lists live too.
  useEffect(() => {
    if (!unlocked) return;
    const id = setInterval(() => document.visibilityState === "visible" && loadAdmin(), 15000);
    return () => clearInterval(id);
  }, [unlocked, loadAdmin]);

  const adminCall = async (fn: string, args: Record<string, unknown>) => {
    setConfirmRemove(null);
    try {
      await sbRpc(fn, { p_pin: pin, ...args });
      await Promise.all([loadAdmin(), load()]);
    } catch {
      setPinErr("Could not update — check the PIN and connection");
    }
  };

  const local = offline && !stats ? localEventCounts() : null;
  const tot: Counts = stats?.totals ?? local ?? {};
  const today: Counts = stats?.today ?? {};
  const ff = stats?.footfall;

  const kpis = [
    { Icon: UserCheck, v: stats?.users.total, l: "Registered tourists", d: `+${n(stats?.users.today)} today · ${n(stats?.users.signed_in)} signed in` },
    { Icon: Activity, v: tot.open, l: "App sessions", d: `+${n(today.open)} today` },
    { Icon: Camera, v: stats?.scans.total ?? tot.scan, l: "Monuments scanned", d: `${pctOf(stats?.scans.identified ?? 0, stats?.scans.total ?? 0)}% identified` },
    { Icon: MessageCircle, v: (tot.ask ?? 0) + (tot.voice ?? 0), l: "Guide questions", d: `${n(tot.voice)} by voice · +${n((today.ask ?? 0) + (today.voice ?? 0))} today` },
    { Icon: Route, v: ff?.trips ?? tot.plan, l: "Trips planned", d: `${n(ff?.people_planned)} people · ${n(ff?.navigated_trips)} navigated` },
    { Icon: Users, v: ff?.rerouted_people, l: "Visitors redirected", d: `${n(ff?.confirmed_people)} confirmed on the road` },
    { Icon: HandHeart, v: tot.artisan_contact, l: "Artisan contacts", d: `+${n(today.artisan_contact)} today` },
    { Icon: Megaphone, v: stats?.crowd.total ?? tot.crowd_report, l: "Crowd reports", d: stats?.crowd.avg_today != null ? `today avg ${stats.crowd.avg_today}/10` : "rated 1–10" },
    { Icon: Stamp, v: stats?.passport.stamps ?? tot.stamp, l: "Passport stamps", d: `${n(stats?.passport.holders)} passport holders` },
    { Icon: ShieldAlert, v: stats?.sos.total ?? tot.sos, l: "SOS calls placed", d: `${n(stats?.sos.today)} today` },
  ];

  /* ----- activity, last 24 h (IST hours from the server) ----- */
  const hourly = stats?.hourly ?? [];
  const hourMax = Math.max(1, ...hourly.map((h) => h.c));
  const peak = hourly.reduce<Stats["hourly"][number] | null>((a, b) => (!a || b.c > a.c ? b : a), null);
  const selIdx = hourSel ?? hourly.length - 1;
  const sel = hourly[selIdx];

  /* ----- district report rows ----- */
  const now = new Date();
  const reportDate = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const siteRows = SITES.map((s) => {
    const c = crowd(s, undefined);
    const hours = hourlyForecast(s, now);
    const pk = hours.reduce((a, b) => (b.pct > a.pct ? b : a), hours[0]);
    const live = stats?.crowd.live[s.id];
    return {
      id: s.id,
      name: s.name.en,
      gem: s.lesserKnown,
      now: c.pct,
      level: c.level,
      peakPct: pk.pct,
      peakHour: pk.hour,
      bestHour: bestHours(s, now)[0] ?? 7,
      rating: live?.avg ?? null,
      reports: live?.n ?? 0,
      appUse: stats?.sites?.[s.id] ?? 0,
      redirectedIn: ff?.to_site[s.id] ?? 0,
      relieved: ff?.from_site[s.id] ?? 0,
      shifted: ff?.shifted_site[s.id] ?? 0,
      stamps: stats?.passport.by_site[s.id] ?? 0,
    };
  }).sort((a, b) => b.now - a.now);

  /* ----- artisans ----- */
  const removed = new Set(stats?.artisans.removed_builtin ?? []);
  const artisanName = (id: string) =>
    SAMPLE_ARTISANS.find((a) => a.id === id)?.name[lang] ?? stats?.artisans.names[id] ?? (id.startsWith("reg-") ? "Removed registration" : id);
  const contacts = Object.entries(stats?.artisans.contacts ?? {}).sort((a, b) => b[1] - a[1]);

  /* ----- projection: official baseline × rates measured in the app ----- */
  const trips = ff?.trips ?? 0;
  const enough = trips >= 10;
  const measured = {
    reroute: ff && ff.people_planned ? ff.rerouted_people / ff.people_planned : null,
    gem: ff && ff.people_planned ? ff.redirected_people / ff.people_planned : null,
    follow: ff && ff.rerouted_people && ff.navigated_trips >= 5 ? ff.confirmed_people / ff.rerouted_people : null,
    // share of visitor sessions that contacted at least one artisan (needs 20+ sessions of data)
    contact: stats?.reach && stats.reach.sessions >= 20 ? stats.reach.artisan_sessions / stats.reach.sessions : null,
    group: stats?.plans.avg_group ?? null,
  };
  const FALLBACK = { reroute: 0.3, gem: 0.12, follow: 0.6, contact: 0.25, group: 2.5 };
  const rate = (k: keyof typeof FALLBACK) => {
    if (override[k] != null) return { v: override[k]!, src: "manual" as const };
    const m = measured[k];
    if (m != null && (k === "group" || k === "contact" || enough)) return { v: m, src: "live" as const };
    return { v: FALLBACK[k], src: "assumed" as const };
  };
  const R = { reroute: rate("reroute"), gem: rate("gem"), follow: rate("follow"), contact: rate("contact"), group: rate("group") };
  const tourists_ = asiVisits / sitesPer;
  const users = (tourists_ * adoption) / 100;
  const moved = users * R.reroute.v * R.follow.v;
  const gemVisits = users * R.gem.v * R.follow.v;
  const groups = users / Math.max(1, R.group.v);
  const purchases = groups * Math.min(1, R.contact.v) * (conversion / 100);
  const income = purchases * spend;
  const relief = pctOf(moved * sitesPer, asiVisits);

  const downloadCsv = () => {
    const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const row = (...cells: (string | number | null | undefined)[]) => cells.map(esc).join(",");
    const lines = [
      row("PAYANA — District tourism dashboard", reportDate, `generated ${new Date().toLocaleString("en-IN")}`),
      "",
      row("Metric", "All time", "Today (IST)"),
      ...Object.keys(TYPE_LABEL).map((k) => row(TYPE_LABEL[k], tot[k] ?? 0, today[k] ?? 0)),
      row("Registered tourists", stats?.users.total, stats?.users.today),
      row("Passport stamps", stats?.passport.stamps, ""),
      "",
      row("Footfall redistribution", "People"),
      row("Trips planned (one per visitor session)", ff?.trips),
      row("People in planned trips", ff?.people_planned),
      row("Moved to hidden gems", ff?.redirected_people),
      row("Shifted to quieter hours", ff?.shifted_people),
      row("Redirected (any)", ff?.rerouted_people),
      row("Confirmed (started navigation)", ff?.confirmed_people),
      row("Average crowd faced: typical plan → PAYANA plan (%)", `${ff?.crowd_from ?? "—"} → ${ff?.crowd_to ?? "—"}`),
      "",
      row("Last 24 h (IST hour)", "Events", "App opens", "Distinct visitors"),
      ...hourly.map((h) => row(h.h.replace("T", " "), h.c, h.opens, h.visitors)),
      "",
      row("Site", "Hidden gem", "Crowd now (%)", "Visitor rating 2h (/10)", "Reports 2h", "Peak today (%)", "Peak hour", "Best hour", "App use", "Redirected in", "Relieved (moved away)", "Shifted off-peak", "Passport stamps"),
      ...siteRows.map((r) =>
        row(r.name, r.gem ? "yes" : "no", r.now, r.rating ?? "", r.reports, r.peakPct, fmtHour(r.peakHour), fmtHour(r.bestHour), r.appUse, r.redirectedIn, r.relieved, r.shifted, r.stamps),
      ),
      "",
      row("Language", "Events"),
      ...Object.entries(stats?.langs ?? {}).map(([k, v]) => row(k, v)),
      "",
      row("Artisan", "Contacts"),
      ...contacts.map(([id, c]) => row(artisanName(id), c)),
      "",
      row("SOS line", "Calls"),
      ...Object.entries(stats?.sos.lines ?? {}).map(([k, v]) => row(k, v)),
      "",
      row("Projection (annual)", "Value"),
      row("ASI ticketed visits (baseline)", Math.round(asiVisits)),
      row("Tourists using PAYANA", Math.round(users)),
      row("Visits moved off peak", Math.round(moved)),
      row("Visits to hidden gems", Math.round(gemVisits)),
      row("Direct artisan income (₹)", Math.round(income)),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payana-district-report-${now.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const langTotal = Object.values(stats?.langs ?? {}).reduce((a, b) => a + b, 0);
  const visibleTourists = showAllTourists ? tourists : tourists.slice(0, 8);
  const byType = useMemo(() => Object.entries(stats?.activity_24h.by_type ?? {}).sort((a, b) => b[1] - a[1]), [stats]);

  const liveLabel = offline ? "Offline — showing last data" : lastOk ? `Live · updated ${Math.max(0, Math.round((clock - lastOk) / 1000))}s ago` : "Connecting…";

  return (
    <div className="pb-nav">
      <TopBar
        title={t("menu.dashboard")}
        right={
          <button onClick={load} className="p-1.5 text-gold" aria-label="Refresh">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        }
      />

      {/* live status + jump links */}
      <div className="no-print sticky top-[53px] z-20 border-b border-gold/10 bg-maroon-950/90 px-4 py-2 backdrop-blur-xl">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
          {offline ? (
            <span className="text-busy">● {liveLabel}</span>
          ) : (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-calm opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-calm" />
              </span>
              <span className="text-calm">{liveLabel}</span>
            </>
          )}
          {stats && <span className="ml-auto font-medium normal-case tracking-normal text-muted">{n(stats.events_today)} events today</span>}
        </p>
        <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5 text-[11px] [scrollbar-width:none]">
          {[
            ["overview", "Overview"],
            ["activity", "24 h"],
            ["report", "Report"],
            ["footfall", "Footfall"],
            ["crowd", "Crowd"],
            ["people", "Tourists"],
            ["artisans", "Artisans"],
            ["impact", "Impact"],
            ["admin", "Admin"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-gold/25 px-3 py-1 text-sand">
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <section id="overview" className="scroll-mt-28 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          {kpis.map(({ Icon, v, l, d }) => (
            <div key={l} className="card p-3">
              <Icon size={18} className="text-gold" />
              <p className="mt-1 font-display text-3xl text-cream tabular-nums">{n(v)}</p>
              <p className="text-[11px] font-semibold text-sand">{l}</p>
              {stats && <p className="text-[10px] text-muted">{d}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Activity — last 24 hours */}
      <Section
        id="activity"
        title="Activity · last 24 h"
        icon={<TrendingUp size={16} className="text-teal" />}
        sub="Every action in the app, grouped by hour (IST). Tap a bar for details."
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Events", stats?.activity_24h.events],
            ["App sessions", stats?.activity_24h.sessions],
            ["Distinct visitors", stats?.activity_24h.visitors],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-maroon-900/80 p-2">
              <p className="font-display text-2xl text-cream tabular-nums">{n(v as number)}</p>
              <p className="text-[9px] text-muted">{l}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 h-4 text-center text-[11px] text-sand">
          {sel ? (
            <>
              <b className="text-gold-light">
                {hour12(sel.hour)}–{hour12((sel.hour + 1) % 24)}
              </b>{" "}
              · {n(sel.c)} events · {n(sel.opens)} opens · {n(sel.visitors)} visitors
            </>
          ) : (
            "—"
          )}
        </p>
        <div className="mt-1 flex h-28 items-end gap-[3px]">
          {hourly.map((h, i) => (
            <button
              key={h.h}
              onClick={() => setHourSel(i)}
              className="relative flex h-full flex-1 items-end"
              aria-label={`${hour12(h.hour)}: ${h.c} events`}
            >
              <span
                className={`w-full rounded-t ${i === selIdx ? "bg-gold" : i === hourly.length - 1 ? "bg-teal" : "bg-teal/70"}`}
                style={{ height: `${h.c ? Math.max(6, (h.c / hourMax) * 100) : 2}%`, opacity: h.c ? 1 : 0.3 }}
              />
            </button>
          ))}
        </div>
        <div className="mt-1 flex gap-[3px] text-[9px] text-muted">
          {hourly.map((h, i) => (
            <span key={h.h} className="flex-1 text-center">
              {h.hour % 3 === 0 || i === hourly.length - 1 ? (i === hourly.length - 1 ? "now" : hour12(h.hour)) : ""}
            </span>
          ))}
        </div>
        {peak && peak.c > 0 && (
          <p className="mt-2 text-[11px] text-muted">
            Busiest hour: <b className="text-sand">{hour12(peak.hour)}–{hour12((peak.hour + 1) % 24)}</b> with {n(peak.c)} events.
          </p>
        )}
        {byType.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {byType.map(([k, v]) => (
              <span key={k} className="rounded-full bg-maroon-900/80 px-2.5 py-1 text-[10px] text-sand">
                {TYPE_LABEL[k] ?? k} <b className="text-gold">{n(v)}</b>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* District Administrator report */}
      <Section
        id="report"
        title="District footfall report"
        icon={<FileSpreadsheet size={17} className="text-gold" />}
        sub={`${reportDate} · crowd index per site (model + live visitor ratings) with app activity`}
      >
        <div className="no-print flex gap-2">
          <button onClick={downloadCsv} className="btn-gold flex-1 py-2 text-xs">
            <Download size={14} /> Download CSV (all data)
          </button>
          <button onClick={() => window.print()} className="btn-ghost flex-1 py-2 text-xs">
            <Printer size={14} /> Print / PDF
          </button>
        </div>
        <div className="-mx-1 mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead className="text-[10px] uppercase tracking-wider text-gold">
              <tr>
                {["Site", "Now", "Rating", "Peak today", "Best", "App use", "In", "Relieved", "Stamps"].map((h) => (
                  <th key={h} className="px-1 py-1.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {siteRows.map((r) => (
                <tr key={r.id}>
                  <td className="px-1 py-1.5 font-medium text-cream">
                    {r.gem ? "💎 " : ""}
                    {r.name}
                  </td>
                  <td className="px-1 py-1.5 font-semibold" style={{ color: LEVEL_COLOR[r.level] }}>
                    {r.now}%
                  </td>
                  <td className="px-1 py-1.5">
                    {r.rating != null ? (
                      <span className="font-semibold" style={{ color: ratingColor(r.rating) }}>
                        {r.rating}/10 <span className="font-normal text-muted">({r.reports})</span>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-1 py-1.5 text-sand">
                    {r.peakPct}% @ {fmtHour(r.peakHour)}
                  </td>
                  <td className="px-1 py-1.5 text-teal">{fmtHour(r.bestHour)}</td>
                  <td className="px-1 py-1.5 text-sand">{r.appUse}</td>
                  <td className="px-1 py-1.5 text-sand">{r.redirectedIn}</td>
                  <td className="px-1 py-1.5 text-sand">{r.relieved}</td>
                  <td className="px-1 py-1.5 text-sand">{r.stamps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted">
          Crowd index 0–100 = forecast (day, hour, season, holidays, festivals) corrected by visitor ratings (1–10) from the last 2 hours. In = visitors
          redirected to the site; Relieved = visitors moved away from it at a crowded time.
        </p>
      </Section>

      {/* Footfall redistribution */}
      <Section
        id="footfall"
        title="Footfall redirected"
        icon={<Gem size={16} className="text-gold" />}
        sub="People, counted once per visitor session (their final plan) and weighted by group size."
      >
        {!ff || ff.trips === 0 ? (
          <p className="text-xs text-muted">No trips planned yet — build a plan in the Trip tab.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                ["Moved to hidden gems", ff.redirected_people, "text-gold"],
                ["Shifted to quieter hours", ff.shifted_people, "text-teal"],
                ["Redirected in total", ff.rerouted_people, "text-cream"],
                ["Confirmed on the road", ff.confirmed_people, "text-calm"],
              ].map(([l, v, c]) => (
                <div key={l as string} className="rounded-xl bg-maroon-900/80 p-2.5">
                  <p className={`font-display text-2xl tabular-nums ${c}`}>{n(v as number)}</p>
                  <p className="text-[10px] text-muted">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-sand">
              {pctOf(ff.rerouted_people, ff.people_planned)}% of the {n(ff.people_planned)} people in {n(ff.trips)} trips got a crowd-smart change
              {ff.plans_built > ff.trips ? ` (${n(ff.plans_built)} plans built incl. re-plans)` : ""}.
              {ff.crowd_from != null && ff.crowd_to != null && (
                <>
                  {" "}
                  Average crowd at the changed stops: <b className="text-packed">{ff.crowd_from}%</b> → <b className="text-calm">{ff.crowd_to}%</b>.
                </>
              )}
            </p>
            {Object.keys(ff.to_site).length > 0 && (
              <div className="mt-4">
                <p className="label">Redirected to (hidden gems)</p>
                <Bars rows={Object.entries(ff.to_site).sort((a, b) => b[1] - a[1]).map(([id, v]) => [`💎 ${getSite(id)?.name[lang] ?? id}`, v])} />
              </div>
            )}
            {Object.keys(ff.from_site).length > 0 && (
              <div className="mt-4">
                <p className="label">Relieved at peak hours</p>
                <Bars rows={Object.entries(ff.from_site).sort((a, b) => b[1] - a[1]).map(([id, v]) => [getSite(id)?.name[lang] ?? id, v, "#ee6a55"])} />
              </div>
            )}
            {Object.keys(ff.shifted_site).length > 0 && (
              <div className="mt-4">
                <p className="label">Visited at a quieter time</p>
                <Bars rows={Object.entries(ff.shifted_site).sort((a, b) => b[1] - a[1]).map(([id, v]) => [getSite(id)?.name[lang] ?? id, v, "#7fd8c4"])} />
              </div>
            )}
          </>
        )}
      </Section>

      {/* Live crowd reports 1–10 */}
      <Section
        id="crowd"
        title="Live crowd reports"
        icon={<Megaphone size={16} className="text-gold" />}
        sub="Visitors rate the crowd from 1 (almost empty) to 10 (packed)."
      >
        {Object.keys(stats?.crowd.live ?? {}).length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {Object.entries(stats!.crowd.live)
              .sort((a, b) => b[1].avg - a[1].avg)
              .map(([id, v]) => (
                <div key={id} className="rounded-xl bg-maroon-900/80 p-2.5">
                  <p className="font-display text-2xl font-semibold" style={{ color: ratingColor(v.avg) }}>
                    {v.avg}
                    <span className="text-sm text-muted">/10</span>
                  </p>
                  <p className="truncate text-[11px] text-sand">{getSite(id)?.name[lang] ?? id}</p>
                  <p className="text-[10px] text-muted">
                    {v.n} report{v.n === 1 ? "" : "s"} · last 2 h
                  </p>
                </div>
              ))}
          </div>
        )}
        {(stats?.crowd.recent ?? []).length === 0 ? (
          <p className="text-xs text-muted">No reports yet — rate the crowd on any site page.</p>
        ) : (
          <ul className="divide-y divide-gold/10">
            {stats!.crowd.recent.slice(0, 12).map((r, i) => (
              <li key={i} className="flex items-center gap-3 py-2 text-sm">
                <span
                  className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold text-maroon-950"
                  style={{ background: ratingColor(r.rating) }}
                >
                  {r.rating}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{getSite(r.site_id)?.name[lang] ?? r.site_id}</span>
                  <span className="text-[10px] text-muted">rated {r.rating}/10</span>
                </span>
                <span className="text-[10px] text-muted">{ago(r.created_at, clock)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-muted">
          {n(stats?.crowd.today)} reports today{stats?.crowd.avg_today != null ? ` · average ${stats.crowd.avg_today}/10` : ""} · {n(stats?.crowd.total)} all time
        </p>
      </Section>

      {/* Tourists, passport, languages, trips, scans, safety */}
      <Section id="people" title="Tourists & usage" icon={<Users size={16} className="text-gold" />}>
        <div className="grid grid-cols-2 gap-2 text-center">
          {[
            ["Registered", stats?.users.total],
            ["Joined this week", stats?.users.week],
            ["Signed in now", stats?.users.signed_in],
            ["Logged in (24 h)", stats?.users.logins_24h],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-maroon-900/80 p-2">
              <p className="font-display text-2xl text-cream tabular-nums">{n(v as number)}</p>
              <p className="text-[10px] text-muted">{l}</p>
            </div>
          ))}
        </div>

        <p className="label mt-4">Heritage Passport stamps by site</p>
        {Object.keys(stats?.passport.by_site ?? {}).length === 0 ? (
          <p className="text-xs text-muted">No stamps yet.</p>
        ) : (
          <Bars rows={Object.entries(stats!.passport.by_site).sort((a, b) => b[1] - a[1]).map(([id, v]) => [getSite(id)?.name[lang] ?? id, v])} />
        )}

        <p className="label mt-4">Languages used</p>
        {langTotal === 0 ? (
          <p className="text-xs text-muted">No data yet.</p>
        ) : (
          <>
            <div className="flex h-4 overflow-hidden rounded-full">
              {Object.entries(stats!.langs).map(([k, v]) => (
                <div key={k} style={{ width: `${(v / langTotal) * 100}%`, background: LANG_COLORS[k] }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs">
              {Object.entries(stats!.langs).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: LANG_COLORS[k] }} />
                  {{ kn: "ಕನ್ನಡ", hi: "हिंदी", en: "English" }[k] ?? k} · {Math.round((v / langTotal) * 100)}% ({n(v)})
                </span>
              ))}
            </div>
          </>
        )}

        <p className="label mt-4">Trips</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["Avg group", stats?.plans.avg_group ?? "—"],
            ["Avg stops", stats?.plans.avg_stops ?? "—"],
            ["Avg days", stats?.plans.avg_days ?? "—"],
            ["Multi-day", stats?.plans.multi_day ?? 0],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-maroon-900/80 p-2">
              <p className="font-display text-xl text-cream">{v}</p>
              <p className="text-[9px] text-muted">{l}</p>
            </div>
          ))}
        </div>
        {Object.keys(stats?.plans.modes ?? {}).length > 0 && (
          <p className="mt-2 text-[11px] text-sand">
            Travel mode:{" "}
            {Object.entries(stats!.plans.modes)
              .map(([k, v]) => `${k} ${pctOf(v, trips)}%`)
              .join(" · ")}
          </p>
        )}

        <p className="label mt-4">Monument recognition</p>
        <p className="text-[11px] text-sand">
          {n(stats?.scans.total)} scans · {n(stats?.scans.identified)} identified ({pctOf(stats?.scans.identified ?? 0, stats?.scans.total ?? 0)}%) ·{" "}
          {Object.entries(stats?.scans.providers ?? {})
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ")}
        </p>

        <p className="label mt-4 flex items-center gap-1.5">
          <ShieldAlert size={12} /> Safety — SOS calls
        </p>
        {(stats?.sos.total ?? 0) === 0 ? (
          <p className="text-xs text-muted">No SOS calls placed from the app.</p>
        ) : (
          <>
            <p className="text-[11px] text-sand">
              {Object.entries(stats!.sos.lines)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </p>
            <ul className="mt-1 text-[11px] text-muted">
              {stats!.sos.recent.map((s, i) => (
                <li key={i}>
                  Called {s.line} · {ago(s.created_at, clock)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* Artisans */}
      <Section id="artisans" title="Artisans & local income" icon={<Store size={16} className="text-gold" />}>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["Directory", SAMPLE_ARTISANS.length - removed.size],
            ["Registered", stats?.artisans.approved],
            ["Pending", stats?.artisans.pending],
            ["Contacts", tot.artisan_contact],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-maroon-900/80 p-2">
              <p className="font-display text-xl text-cream">{n(v as number)}</p>
              <p className="text-[9px] text-muted">{l}</p>
            </div>
          ))}
        </div>
        {Object.keys(stats?.artisans.contact_how ?? {}).length > 0 && (
          <p className="mt-2 text-[11px] text-sand">
            How tourists reached out:{" "}
            {Object.entries(stats!.artisans.contact_how)
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ")}
          </p>
        )}
        <p className="label mt-4">Most contacted</p>
        {contacts.length === 0 ? (
          <p className="text-xs text-muted">No contacts yet.</p>
        ) : (
          <Bars rows={contacts.slice(0, 8).map(([id, v]) => [artisanName(id), v])} />
        )}
      </Section>

      {/* Projection */}
      <Section
        id="impact"
        title="Projected annual impact"
        icon={<TrendingUp size={16} className="text-teal" />}
        sub="Official ASI footfall × behaviour measured live in this app. Rates marked LIVE update as tourists use PAYANA."
      >
        <Slider
          label="ASI ticketed visits / year (Badami + Pattadakal + Aihole)"
          value={asiVisits}
          set={setAsiVisits}
          min={300000}
          max={2500000}
          step={10000}
          fmt={lakh}
          note={
            <>
              Default {lakh(ASI_TOTAL)}: Badami {lakh(ASI_VISITS.badami)}, Pattadakal {lakh(ASI_VISITS.pattadakal)}, Aihole {lakh(ASI_VISITS.aihole)} (ASI).
            </>
          }
        />
        <Slider label="ASI monuments seen per tourist" value={sitesPer} set={setSitesPer} min={1} max={3} step={0.1} fmt={(v) => v.toFixed(1)} note={`≈ ${lakh(tourists_)} heritage tourists a year`} />
        <Slider label="Tourists using PAYANA" value={adoption} set={setAdoption} min={1} max={40} step={1} fmt={(v) => `${v}%`} />

        <p className="label mt-3">Behaviour rates</p>
        {(
          [
            ["reroute", "Get a crowd-smart change to their plan", 0.05, 0.9, 0.01, (v: number) => `${Math.round(v * 100)}%`],
            ["gem", "Of which: visit a hidden gem", 0.01, 0.6, 0.01, (v: number) => `${Math.round(v * 100)}%`],
            ["follow", "Follow the plan on the road", 0.1, 1, 0.05, (v: number) => `${Math.round(v * 100)}%`],
            ["contact", "Contact an artisan (per group)", 0.02, 1, 0.01, (v: number) => `${Math.round(v * 100)}%`],
            ["group", "Average group size", 1, 8, 0.1, (v: number) => v.toFixed(1)],
          ] as const
        ).map(([k, label, min, max, step, fmt]) => (
          <Slider
            key={k}
            label={label}
            value={R[k].v}
            set={(v) => setOverride((o) => ({ ...o, [k]: v }))}
            min={min}
            max={max}
            step={step}
            fmt={fmt}
            note={
              <span className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-px text-[9px] font-bold uppercase ${
                    R[k].src === "live" ? "bg-calm/20 text-calm" : R[k].src === "manual" ? "bg-gold/20 text-gold" : "bg-white/10 text-muted"
                  }`}
                >
                  {R[k].src}
                </span>
                {measured[k] != null ? `measured ${fmt(measured[k]!)}` : "no app data yet"}
                {R[k].src === "assumed" && measured[k] != null && !enough && ` (from ${trips} trips — needs 10)`}
                {k === "contact" && measured.contact == null && stats?.reach ? ` (${stats.reach.sessions} sessions tracked — needs 20)` : ""}
                {R[k].src === "manual" && (
                  <button onClick={() => setOverride((o) => ({ ...o, [k]: undefined }))} className="text-gold underline">
                    reset
                  </button>
                )}
              </span>
            }
          />
        ))}
        <Slider label="Contacts that become a purchase" value={conversion} set={setConversion} min={5} max={90} step={5} fmt={(v) => `${v}%`} note="assumption — replace with a survey figure" />
        <Slider label="Average purchase" value={spend} set={setSpend} min={100} max={5000} step={50} fmt={(v) => `₹${n(v)}`} note="assumption — sarees, meals, homestays, guides" />

        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          {[
            [lakh(users), "tourists using PAYANA / yr", "text-cream"],
            [lakh(moved), "visits moved off peak / yr", "text-teal"],
            [lakh(gemVisits), "visits to hidden gems / yr", "text-gold"],
            [`₹${(income / 100000).toFixed(1)} L`, "direct artisan income / yr", "text-gold"],
          ].map(([v, l, c]) => (
            <div key={l} className="rounded-xl bg-maroon-900/80 p-2.5">
              <p className={`font-display text-2xl ${c}`}>{v}</p>
              <p className="text-[10px] text-muted">{l}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted">
          Tourists = ASI visits ÷ monuments per tourist. Moved = users × change rate × follow-through ({relief}% of all ASI visits). Income = groups × contact rate
          × purchase rate × average purchase.
        </p>
      </Section>

      {/* Admin tools (PIN) */}
      <Section
        id="admin"
        title="Admin tools"
        icon={<KeyRound size={16} className="text-gold" />}
        sub="Verify registrations, remove any artisan, and view registered tourists (PIN protected)."
      >
        {!unlocked ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadAdmin();
            }}
            className="flex gap-2"
          >
            <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric" placeholder="Admin PIN" className="input" />
            <button className="btn-gold px-5">Open</button>
          </form>
        ) : (
          <>
            {/* Registered artisans */}
            <p className="label flex items-center justify-between">
              <span>Registered artisans ({regs.length})</span>
              <span className="normal-case tracking-normal text-muted">
                {n(stats?.artisans.pending)} pending · {n(stats?.artisans.approved)} approved
              </span>
            </p>
            {regs.length === 0 ? (
              <p className="text-xs text-muted">No registrations yet.</p>
            ) : (
              <ul className="space-y-2">
                {regs.map((r) => (
                  <li key={r.id} className="rounded-xl bg-maroon-900/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {r.photo_url && <img src={r.photo_url} alt="" className="mb-2 h-24 w-full rounded-lg object-cover" />}
                        <p className="font-semibold">{r.name}</p>
                        <p className="text-xs text-muted">
                          {r.craft} · {r.phone ?? "no phone"} · joined {new Date(r.created_at).toLocaleDateString("en-IN")}
                        </p>
                        <p className="mt-1 text-xs text-sand">
                          📍 {r.address ? `${r.address}, ${r.town}` : r.town}
                          {r.lat != null && r.lng != null && <span className="ml-1 text-teal">· GPS pinned</span>}
                        </p>
                        <a href={mapSearchUrl({ lat: r.lat, lng: r.lng, address: r.address, town: r.town })} target="_blank" rel="noreferrer" className="text-xs font-semibold text-gold underline">
                          View on Google Maps ↗
                        </a>
                        {r.description && <p className="mt-1 text-xs text-sand">{r.description}</p>}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.status === "approved" ? "bg-calm/20 text-calm" : r.status === "rejected" ? "bg-packed/20 text-packed" : "bg-moderate/20 text-moderate"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => adminCall("admin_set_artisan_status", { p_id: r.id, p_status: "approved" })} className="btn-teal flex-1 py-2 text-xs">
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button onClick={() => adminCall("admin_set_artisan_status", { p_id: r.id, p_status: "rejected" })} className="btn-ghost flex-1 py-2 text-xs">
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                    <RemoveButton
                      name={r.name}
                      armed={confirmRemove === r.id}
                      arm={() => setConfirmRemove(r.id)}
                      cancel={() => setConfirmRemove(null)}
                      confirm={() => adminCall("admin_delete_artisan", { p_id: r.id })}
                      note="They will have to register again."
                    />
                  </li>
                ))}
              </ul>
            )}

            {/* Built-in directory */}
            <p className="label mt-5">Directory listings ({SAMPLE_ARTISANS.length - removed.size} shown)</p>
            <ul className="space-y-2">
              {SAMPLE_ARTISANS.map((a) => {
                const gone = removed.has(a.id);
                const key = `b-${a.id}`;
                return (
                  <li key={a.id} className={`rounded-xl bg-maroon-900/70 p-3 ${gone ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-3">
                      <img src={photo(a.image).src} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{a.name[lang]}</p>
                        <p className="truncate text-xs text-muted">
                          {a.craft[lang]} · {a.town}
                        </p>
                      </div>
                      {gone && <span className="shrink-0 rounded-full bg-packed/20 px-2 py-0.5 text-[10px] font-bold text-packed">removed</span>}
                    </div>
                    {gone ? (
                      <button onClick={() => adminCall("admin_restore_builtin_artisan", { p_key: a.id })} className="btn-ghost mt-2 w-full py-2 text-xs">
                        <RotateCcw size={13} /> Restore listing
                      </button>
                    ) : (
                      <RemoveButton
                        name={a.name[lang]}
                        armed={confirmRemove === key}
                        arm={() => setConfirmRemove(key)}
                        cancel={() => setConfirmRemove(null)}
                        confirm={() => adminCall("admin_remove_builtin_artisan", { p_key: a.id })}
                        note="It disappears from the Artisans tab, site pages, trip plans and the AI guide."
                      />
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Tourists */}
            <p className="label mt-5">Registered tourists ({tourists.length})</p>
            {tourists.length === 0 ? (
              <p className="text-xs text-muted">No tourist accounts yet.</p>
            ) : (
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-[11px]">
                  <thead className="text-[10px] uppercase tracking-wider text-gold">
                    <tr>
                      {["Name", "Email", "Joined", "Last login", "Stamps"].map((h) => (
                        <th key={h} className="px-1 py-1.5 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {visibleTourists.map((u) => (
                      <Fragment key={u.email}>
                        <tr>
                          <td className="px-1 py-1.5 font-medium text-cream">
                            {u.active && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-calm align-middle" />}
                            {u.name}
                          </td>
                          <td className="px-1 py-1.5 text-sand">{u.email}</td>
                          <td className="px-1 py-1.5 text-sand">{new Date(u.created_at).toLocaleDateString("en-IN")}</td>
                          <td className="px-1 py-1.5 text-sand">{u.last_login_at ? ago(u.last_login_at, clock) : "—"}</td>
                          <td className="px-1 py-1.5 text-gold">{u.stamps}</td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tourists.length > 8 && (
              <button onClick={() => setShowAllTourists((v) => !v)} className="mt-2 text-xs font-semibold text-gold underline">
                {showAllTourists ? "Show fewer" : `Show all ${tourists.length}`}
              </button>
            )}
          </>
        )}
        {pinErr && <p className="mt-2 text-xs text-packed">{pinErr}</p>}
      </Section>

      <p className="mt-4 px-6 text-center text-[10px] leading-snug text-muted">
        Usage analytics are anonymous (a random id per app session, no locations). Tourist names and emails are shown only with the admin PIN.
      </p>
    </div>
  );
}

function RemoveButton({ name, armed, arm, cancel, confirm, note }: { name: string; armed: boolean; arm: () => void; cancel: () => void; confirm: () => void; note: string }) {
  if (!armed) {
    return (
      <button onClick={arm} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-packed/50 py-2 text-xs font-semibold text-packed">
        <Trash2 size={13} /> Remove from app
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-xl border border-packed/40 bg-packed/10 p-2.5">
      <p className="text-xs text-cream">
        Remove {name} from the app? {note}
      </p>
      <div className="mt-2 flex gap-2">
        <button onClick={cancel} className="btn-ghost flex-1 py-2 text-xs">
          Cancel
        </button>
        <button onClick={confirm} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-packed py-2 text-xs font-semibold text-white">
          <Trash2 size={13} /> Yes, remove
        </button>
      </div>
    </div>
  );
}
