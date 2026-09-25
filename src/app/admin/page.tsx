"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Gem,
  Printer,
  HandHeart,
  KeyRound,
  Loader2,
  MessageCircle,
  Megaphone,
  RefreshCw,
  Route,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { SAMPLE_ARTISANS } from "@/lib/artisans";
import { SITES, getSite } from "@/lib/sites";
import { mapSearchUrl } from "@/lib/location";
import { LEVEL_COLOR, bestHours, fmtHour, hourlyForecast } from "@/lib/crowd";
import { sbRpc } from "@/lib/supabase";
import { localEventCounts } from "@/lib/analytics";
import { TopBar } from "@/components/ui";

interface Stats {
  totals: Record<string, number>;
  langs: Record<string, number>;
  sites: Record<string, number>;
  reroute_to: Record<string, number>;
  visitors_rerouted: number;
  artisan_contacts: Record<string, number>;
  hourly: { h: string; c: number }[];
  crowd_recent: { site_id: string; level: number; created_at: string }[];
  artisans_pending: number;
  artisans_approved: number;
  events_today: number;
  users_total?: number;
  users_today?: number;
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

const FACES = ["", "😌", "🙂", "😐", "😣", "🥵"];
const LANG_COLORS: Record<string, string> = { kn: "#e8b45a", hi: "#3fd1b5", en: "#f08a3c" };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

export default function AdminPage() {
  const { t, lang, crowd } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState("");
  const [regs, setRegs] = useState<Reg[] | null>(null);
  const [pinErr, setPinErr] = useState("");
  // projection assumptions
  const [visitors, setVisitors] = useState(500000);
  const [adoption, setAdoption] = useState(10);
  const [accept, setAccept] = useState(30);
  const [spend, setSpend] = useState(400);
  const [convert, setConvert] = useState(15);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await sbRpc<Stats>("dashboard_stats");
      setStats(s);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const loadRegs = async (p = pin) => {
    setPinErr("");
    try {
      const rows = await sbRpc<Reg[]>("admin_list_artisans", { p_pin: p });
      setRegs(rows);
    } catch {
      setPinErr("Invalid PIN or offline");
      setRegs(null);
    }
  };

  const setStatus = async (id: string, status: Reg["status"]) => {
    try {
      await sbRpc("admin_set_artisan_status", { p_pin: pin, p_id: id, p_status: status });
      await loadRegs();
      load();
    } catch {
      setPinErr("Could not update");
    }
  };

  const local = offline ? localEventCounts() : null;
  const tot = stats?.totals ?? local ?? {};
  const kpis = [
    { Icon: Camera, v: tot.scan ?? 0, l: "Monuments scanned" },
    { Icon: MessageCircle, v: (tot.ask ?? 0) + (tot.voice ?? 0), l: "Guide questions" },
    { Icon: Route, v: tot.plan ?? 0, l: "Crowd-smart plans" },
    { Icon: Users, v: stats?.visitors_rerouted ?? tot.reroute ?? 0, l: "Visitors rerouted" },
    { Icon: HandHeart, v: tot.artisan_contact ?? 0, l: "Artisan contacts" },
    { Icon: Megaphone, v: tot.crowd_report ?? 0, l: "Crowd reports" },
    { Icon: UserCheck, v: stats?.users_total ?? 0, l: "Registered tourists" },
    { Icon: UserPlus, v: stats?.users_today ?? 0, l: "Signed up today" },
  ];

  const langTotal = Object.values(stats?.langs ?? {}).reduce((a, b) => a + b, 0);
  const reroutes = Object.entries(stats?.reroute_to ?? {}).sort((a, b) => b[1] - a[1]);
  const rerouteMax = Math.max(1, ...reroutes.map((r) => r[1]));
  const hourly = (() => {
    const buckets = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(Date.now() - (23 - i) * 3600_000);
      d.setMinutes(0, 0, 0);
      return { t: d.getTime(), c: 0, h: d.getHours() };
    });
    for (const x of stats?.hourly ?? []) {
      const ts = new Date(x.h).getTime();
      const b = buckets.find((bk) => Math.abs(bk.t - ts) < 1800_000);
      if (b) b.c = x.c;
    }
    return buckets;
  })();
  const hourMax = Math.max(1, ...hourly.map((h) => h.c));
  const contacts = Object.entries(stats?.artisan_contacts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // District report rows
  const today = new Date();
  const reportDate = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const siteRows = SITES.map((s) => {
    const c = crowd(s, undefined);
    const hours = hourlyForecast(s, today);
    const peak = hours.reduce((a, b) => (b.pct > a.pct ? b : a), hours[0]);
    return {
      id: s.id,
      name: s.name.en,
      gem: s.lesserKnown,
      now: c.pct,
      level: c.level,
      peakPct: peak.pct,
      peakHour: peak.hour,
      bestHour: bestHours(s, today)[0] ?? 7,
      reports: c.reports,
      appUse: stats?.sites?.[s.id] ?? 0,
      rerouted: stats?.reroute_to?.[s.id] ?? 0,
    };
  }).sort((a, b) => b.now - a.now);

  const downloadCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ["PAYANA — District footfall & tourism report", reportDate].map(esc).join(","),
      "",
      ["Metric", "Value"].map(esc).join(","),
      ...kpis.map((k) => [k.l, k.v].map(esc).join(",")),
      ...Object.entries(stats?.langs ?? {}).map(([k, v]) => [`Language: ${k}`, v].map(esc).join(",")),
      "",
      ["Site", "Hidden gem", "Crowd now (%)", "Peak today (%)", "Peak hour", "Best hour", "Live reports (2h)", "App use", "Visitors rerouted in"].map(esc).join(","),
      ...siteRows.map((r) =>
        [r.name, r.gem ? "yes" : "no", r.now, r.peakPct, fmtHour(r.peakHour), fmtHour(r.bestHour), r.reports, r.appUse, r.rerouted].map(esc).join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payana-district-report-${today.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Projection
  const users = (visitors * adoption) / 100;
  const redistributed = (users * accept) / 100;
  const income = (users * convert * spend) / 100;

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
      <section className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            {offline ? (
              <span className="text-busy">● Offline · this device only</span>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-calm opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-calm" />
                </span>
                <span className="text-calm">Live · all visitors</span>
              </>
            )}
          </p>
          {stats && <p className="text-[10px] text-muted">Today: {stats.events_today} events · opens {tot.open ?? 0}</p>}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {kpis.map(({ Icon, v, l }) => (
            <div key={l} className="card p-3">
              <Icon size={18} className="text-gold" />
              <p className="mt-1 font-display text-3xl text-cream">{Number(v).toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* District Administrator report: site-wise crowd & footfall index */}
      <section className="mt-5 px-4">
        <div className="card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <FileSpreadsheet size={17} className="text-gold" /> District footfall report
              </h2>
              <p className="text-[11px] text-muted">
                {reportDate} · crowd index per site (model + live visitor reports) with app activity
              </p>
            </div>
          </div>
          <div className="no-print mt-3 flex gap-2">
            <button onClick={downloadCsv} className="btn-gold flex-1 py-2 text-xs">
              <Download size={14} /> Download CSV
            </button>
            <button onClick={() => window.print()} className="btn-ghost flex-1 py-2 text-xs">
              <Printer size={14} /> Print / PDF
            </button>
          </div>
          <div className="-mx-1 mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[11px]">
              <thead className="text-[10px] uppercase tracking-wider text-gold">
                <tr>
                  <th className="px-1 py-1.5 font-semibold">Site</th>
                  <th className="px-1 py-1.5 font-semibold">Now</th>
                  <th className="px-1 py-1.5 font-semibold">Peak today</th>
                  <th className="px-1 py-1.5 font-semibold">Best time</th>
                  <th className="px-1 py-1.5 font-semibold">Reports</th>
                  <th className="px-1 py-1.5 font-semibold">App use</th>
                  <th className="px-1 py-1.5 font-semibold">Rerouted in</th>
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
                    <td className="px-1 py-1.5 text-sand">
                      {r.peakPct}% @ {fmtHour(r.peakHour)}
                    </td>
                    <td className="px-1 py-1.5 text-teal">{fmtHour(r.bestHour)}</td>
                    <td className="px-1 py-1.5 text-sand">{r.reports}</td>
                    <td className="px-1 py-1.5 text-sand">{r.appUse}</td>
                    <td className="px-1 py-1.5 text-sand">{r.rerouted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-muted">
            Crowd index 0–100 is an estimate (day, hour, season, holidays, festivals) adjusted by live visitor reports from the last 2 hours. App use = anonymous scans and guide questions per site.
          </p>
        </div>
      </section>

      {/* Footfall redistribution */}
      <section className="mt-5 px-4">
        <div className="card p-4">
          <h2 className="section-title flex items-center gap-2">
            <Gem size={16} className="text-gold" /> Footfall redirected to
          </h2>
          <p className="mb-3 text-[11px] text-muted">Where crowd-smart plans sent visitors instead of peak-hour icons</p>
          {reroutes.length === 0 ? (
            <p className="text-xs text-muted">No reroutes yet — build a plan in the Trip tab.</p>
          ) : (
            <ul className="space-y-2">
              {reroutes.map(([id, c]) => (
                <li key={id}>
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span>
                      {getSite(id)?.lesserKnown ? "💎 " : ""}
                      {getSite(id)?.name[lang] ?? id}
                    </span>
                    <b className="text-gold">{c}</b>
                  </div>
                  <div className="h-2 rounded-full bg-maroon-900">
                    <div className="h-2 rounded-full bg-linear-to-r from-gold-dark to-gold" style={{ width: `${(c / rerouteMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Languages + hourly */}
      <section className="mt-4 grid grid-cols-1 gap-4 px-4">
        <div className="card p-4">
          <h2 className="section-title mb-3">Languages used</h2>
          {langTotal === 0 ? (
            <p className="text-xs text-muted">No data yet.</p>
          ) : (
            <>
              <div className="flex h-4 overflow-hidden rounded-full">
                {Object.entries(stats!.langs).map(([k, v]) => (
                  <div key={k} style={{ width: `${(v / langTotal) * 100}%`, background: LANG_COLORS[k] }} />
                ))}
              </div>
              <div className="mt-2 flex gap-4 text-xs">
                {Object.entries(stats!.langs).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: LANG_COLORS[k] }} />
                    {{ kn: "ಕನ್ನಡ", hi: "हिंदी", en: "English" }[k] ?? k} · {Math.round((v / langTotal) * 100)}%
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card p-4">
          <h2 className="section-title mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-teal" /> Activity · last 24 h
          </h2>
          <div className="flex h-20 items-end gap-[2px]">
            {hourly.map((h) => (
              <div key={h.t} className="flex-1 rounded-t bg-teal/80" style={{ height: `${Math.max(3, (h.c / hourMax) * 100)}%`, opacity: h.c ? 1 : 0.25 }} title={`${h.h}:00 · ${h.c}`} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-muted">
            <span>-24h</span>
            <span>-12h</span>
            <span>now</span>
          </div>
        </div>
      </section>

      {/* Crowd reports + artisan contacts */}
      <section className="mt-4 grid grid-cols-1 gap-4 px-4">
        <div className="card p-4">
          <h2 className="section-title mb-2">Live crowd reports</h2>
          {(stats?.crowd_recent ?? []).length === 0 ? (
            <p className="text-xs text-muted">No reports yet — tap a face on any site page.</p>
          ) : (
            <ul className="divide-y divide-gold/10">
              {stats!.crowd_recent.slice(0, 8).map((r, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-sm">
                  <span className="text-xl">{FACES[r.level]}</span>
                  <span className="flex-1 truncate">{getSite(r.site_id)?.name[lang] ?? r.site_id}</span>
                  <span className="text-[10px] text-muted">{ago(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <h2 className="section-title mb-2">Top artisan contacts</h2>
          {contacts.length === 0 ? (
            <p className="text-xs text-muted">No contacts yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {contacts.map(([id, c]) => (
                <li key={id} className="flex justify-between text-sm">
                  <span className="truncate">{SAMPLE_ARTISANS.find((a) => a.id === id)?.name[lang] ?? id.replace("reg-", "Registered · ").slice(0, 28)}</span>
                  <b className="text-gold">{c}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Projection */}
      <section className="mt-4 px-4">
        <div className="card border-teal/40 p-4">
          <h2 className="section-title">Projected annual impact</h2>
          <p className="mb-3 text-[11px] text-muted">Model — adjust assumptions to official Tourism Dept figures</p>
          {[
            { l: "Annual visitors (district)", v: visitors, set: setVisitors, min: 100000, max: 2500000, step: 50000, fmt: (x: number) => (x / 100000).toFixed(1) + " lakh" },
            { l: "App adoption", v: adoption, set: setAdoption, min: 1, max: 50, step: 1, fmt: (x: number) => x + "%" },
            { l: "Accept crowd-smart reroute", v: accept, set: setAccept, min: 5, max: 80, step: 5, fmt: (x: number) => x + "%" },
            { l: "Buy from a local artisan", v: convert, set: setConvert, min: 1, max: 60, step: 1, fmt: (x: number) => x + "%" },
            { l: "Average artisan spend", v: spend, set: setSpend, min: 100, max: 3000, step: 50, fmt: (x: number) => "₹" + x },
          ].map((s) => (
            <div key={s.l} className="mb-2">
              <div className="flex justify-between text-xs">
                <span className="text-sand">{s.l}</span>
                <b className="text-gold">{s.fmt(s.v)}</b>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.v} onChange={(e) => s.set(+e.target.value)} className="w-full accent-[#3fd1b5]" />
            </div>
          ))}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-maroon-900/80 p-2">
              <p className="font-display text-xl text-cream">{Math.round(users).toLocaleString("en-IN")}</p>
              <p className="text-[9px] text-muted">app users / yr</p>
            </div>
            <div className="rounded-xl bg-maroon-900/80 p-2">
              <p className="font-display text-xl text-teal">{Math.round(redistributed).toLocaleString("en-IN")}</p>
              <p className="text-[9px] text-muted">visits spread to hidden gems</p>
            </div>
            <div className="rounded-xl bg-maroon-900/80 p-2">
              <p className="font-display text-xl text-gold">₹{(income / 100000).toFixed(1)}L</p>
              <p className="text-[9px] text-muted">direct artisan income</p>
            </div>
          </div>
        </div>
      </section>

      {/* Moderation */}
      <section className="mt-4 px-4">
        <div className="card p-4">
          <h2 className="section-title flex items-center gap-2">
            <KeyRound size={16} className="text-gold" /> Artisan registrations
          </h2>
          <p className="mb-3 text-[11px] text-muted">
            {stats ? `${stats.artisans_pending} pending · ${stats.artisans_approved} approved` : ""} — verify before listing (PIN protected)
          </p>
          {!regs ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadRegs();
              }}
              className="flex gap-2"
            >
              <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric" placeholder="Admin PIN" className="input" />
              <button className="btn-gold px-5">Open</button>
            </form>
          ) : regs.length === 0 ? (
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
                        {r.craft} · {r.phone ?? "no phone"}
                      </p>
                      <p className="mt-1 text-xs text-sand">
                        📍 {r.address ? `${r.address}, ${r.town}` : r.town}
                        {r.lat != null && r.lng != null && <span className="ml-1 text-teal">· GPS pinned</span>}
                      </p>
                      <a
                        href={mapSearchUrl({ lat: r.lat, lng: r.lng, address: r.address, town: r.town })}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-gold underline"
                      >
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
                    <button onClick={() => setStatus(r.id, "approved")} className="btn-teal flex-1 py-2 text-xs">
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button onClick={() => setStatus(r.id, "rejected")} className="btn-ghost flex-1 py-2 text-xs">
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pinErr && <p className="mt-2 text-xs text-packed">{pinErr}</p>}
        </div>
      </section>
      <p className="mt-4 px-6 text-center text-[10px] text-muted">
        Anonymous analytics only — no names, phone numbers or locations of tourists are collected.
      </p>
    </div>
  );
}
