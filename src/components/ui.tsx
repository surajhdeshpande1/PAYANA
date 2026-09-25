"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Accessibility,
  ChevronLeft,
  Gem,
  Landmark,
  LayoutDashboard,
  Menu,
  QrCode,
  ShieldAlert,
  Sparkles,
  Stamp,
  Store,
  Volume2,
  Square,
  X,
} from "lucide-react";
import { LANGS } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { LEVEL_COLOR, fmtHour, fmtTime, hourlyForecast, type CrowdLevel } from "@/lib/crowd";
import { sitePhoto } from "@/lib/sites";
import { speak, stopSpeaking, useSpeaking } from "@/lib/tts";
import type { Site } from "@/lib/types";

/* ---------- Language switch ---------- */
export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useApp();
  return (
    <div className="flex rounded-full border border-gold/30 bg-maroon-950/60 p-0.5 backdrop-blur">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            lang === l.code ? "bg-white text-maroon-950" : "text-sand"
          }`}
          aria-label={l.label}
        >
          {compact ? (l.code === "en" ? "EN" : l.code === "kn" ? "ಕ" : "हि") : l.native}
        </button>
      ))}
    </div>
  );
}

/* ---------- Menu sheet ---------- */
export function MenuButton() {
  const [open, setOpen] = useState(false);
  const { t, a11y, setA11y, setDemoStep } = useApp();
  const links = [
    { href: "/passport", icon: Stamp, label: t("menu.passport") },
    { href: "/sos", icon: ShieldAlert, label: t("menu.sos") },
    { href: "/artisans/register", icon: Store, label: t("menu.register") },
    { href: "/admin", icon: LayoutDashboard, label: t("menu.dashboard") },
    { href: "/share", icon: QrCode, label: t("menu.share") },
  ];
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("menu.title")}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-maroon-950/60 text-gold-light backdrop-blur"
      >
        <Menu size={18} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[75] mx-auto flex max-w-md flex-col justify-end bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="fade-up safe-bottom rounded-t-3xl border-t border-gold/30 bg-maroon-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-xl text-gold-light">{t("menu.title")}</h2>
              <button onClick={() => setOpen(false)} aria-label={t("close")} className="rounded-full p-1.5 text-sand">
                <X size={20} />
              </button>
            </div>
            <p className="label">{t("menu.language")}</p>
            <LangSwitch />
            <button
              onClick={() => setA11y(!a11y)}
              className="card mt-4 flex w-full items-center gap-3 px-4 py-3 text-left"
              role="switch"
              aria-checked={a11y}
            >
              <Accessibility className="text-teal" size={22} />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{t("menu.a11y")}</span>
                <span className="text-xs text-muted">{t("menu.a11yD")}</span>
              </span>
              <span className={`relative h-6 w-11 rounded-full transition ${a11y ? "bg-teal" : "bg-maroon-600"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all ${a11y ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {links.map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-maroon-800">
                  <Icon size={19} className="text-gold" /> {label}
                </Link>
              ))}
              <button
                onClick={() => {
                  setOpen(false);
                  setDemoStep(0);
                }}
                className="btn-teal mt-1"
              >
                <Sparkles size={17} /> {t("menu.demo")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Top bar ---------- */
export function TopBar({ title, back = true, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const router = useRouter();
  const { t } = useApp();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-gold/10 bg-maroon-950/85 px-3 py-2.5 backdrop-blur-xl">
      {back ? (
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          aria-label={t("back")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gold-light hover:bg-maroon-800"
        >
          <ChevronLeft size={22} />
        </button>
      ) : (
        <Link href="/" className="flex h-9 w-9 items-center justify-center">
          <img src="/icons/icon-192.png" alt="PAYANA" className="h-8 w-8 rounded-lg" />
        </Link>
      )}
      <h1 className="flex-1 truncate font-serif text-lg font-semibold text-gold-light">{title}</h1>
      {right}
      <LangSwitch compact />
      <MenuButton />
    </header>
  );
}

/* ---------- Crowd badge ---------- */
export function CrowdBadge({ level, pct, small = false }: { level: CrowdLevel; pct?: number; small?: boolean }) {
  const { t } = useApp();
  const color = LEVEL_COLOR[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}`}
      style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {t(`crowd.${level}`)}
      {pct !== undefined && <span className="opacity-75">· {pct}%</span>}
    </span>
  );
}

/* ---------- Hourly crowd chart ---------- */
export function CrowdChart({ site, day, highlight }: { site: Site; day: Date; highlight?: number }) {
  const data = hourlyForecast(site, day);
  const min = Math.min(...data.filter((d) => d.hour <= 17).map((d) => d.pct));
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]">
        {data.map((d) => {
          const isNow = highlight === d.hour;
          const best = d.pct <= min + 6 && d.hour <= 17;
          return (
            <div key={d.hour} className="flex h-full flex-1 flex-col items-center justify-end">
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${Math.max(6, d.pct)}%`,
                  background: LEVEL_COLOR[d.level],
                  opacity: isNow ? 1 : 0.72,
                  outline: isNow ? "2px solid #f8ecd9" : best ? "1px dashed #3fd1b5" : "none",
                  outlineOffset: 1,
                }}
                title={`${fmtHour(d.hour)} · ${d.pct}%`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted">
        {data.filter((_, i) => i % 3 === 0).map((d) => (
          <span key={d.hour}>{fmtHour(d.hour)}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Time machine (demo "what if it's Sunday noon?") ---------- */
export function TimeMachine() {
  const { t, timeMode, setTimeMode, now } = useApp();
  const real = timeMode === "live" ? now : new Date();
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
      <span className="shrink-0 text-[11px] text-muted">{t("time.viewing")}:</span>
      <button onClick={() => setTimeMode("live")} className={`chip shrink-0 ${timeMode === "live" ? "chip-on" : ""}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${timeMode === "live" ? "bg-maroon-950" : "bg-calm"}`} /> {t("time.now")} · {fmtTime(real).replace(/:\d\d /, " ")}
      </button>
      <button onClick={() => setTimeMode("sunday")} className={`chip shrink-0 ${timeMode === "sunday" ? "chip-on" : ""}`}>
        {t("time.sunday")}
      </button>
    </div>
  );
}

/* ---------- Site card ---------- */
export function SiteCard({ site, wide = false }: { site: Site; wide?: boolean }) {
  const { lang, crowd, t } = useApp();
  const c = crowd(site);
  const ph = sitePhoto(site.id);
  return (
    <Link
      href={`/site/${site.id}`}
      className={`card group relative block shrink-0 overflow-hidden ${wide ? "w-full" : "w-44"}`}
    >
      <div className={`relative ${wide ? "h-40" : "h-28"} overflow-hidden`}>
        <img src={ph.src} alt={site.name.en} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-linear-to-t from-maroon-950/90 via-maroon-950/10 to-transparent" />
        <div className="absolute left-2 top-2 flex gap-1">
          {site.unesco && (
            <span className="rounded-full bg-teal/90 px-2 py-0.5 text-[9px] font-bold text-maroon-950">UNESCO</span>
          )}
          {site.lesserKnown && (
            <span className="flex items-center gap-1 rounded-full bg-gold/90 px-2 py-0.5 text-[9px] font-bold text-maroon-950">
              <Gem size={9} /> {t("site.gem")}
            </span>
          )}
        </div>
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-cream">{site.name[lang]}</h3>
        <p className="mb-1.5 line-clamp-1 text-[11px] text-muted">{site.tagline[lang]}</p>
        <CrowdBadge level={c.level} pct={c.pct} small />
      </div>
    </Link>
  );
}

/* ---------- Speak / listen button ---------- */
export function SpeakButton({ id, text, className = "" }: { id: string; text: string; className?: string }) {
  const { lang, t, toast } = useApp();
  const speaking = useSpeaking();
  const active = speaking === id;
  return (
    <button
      onClick={async () => {
        if (active) return stopSpeaking();
        const r = await speak(id, text, lang);
        if (r === "none") toast(lang === "kn" ? "ಈ ಫೋನ್‌ನಲ್ಲಿ ಕನ್ನಡ ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ." : "Voice not available on this device.");
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active ? "border-teal bg-teal text-maroon-950" : "border-gold/40 text-gold-light hover:bg-maroon-700"
      } ${className}`}
    >
      {active ? (
        <>
          <span className="eq">
            <span />
            <span />
            <span />
            <span />
          </span>
          <Square size={11} fill="currentColor" /> {t("stop")}
        </>
      ) : (
        <>
          <Volume2 size={14} /> {t("listen")}
        </>
      )}
    </button>
  );
}

/* ---------- Crowd reporter ---------- */
const FACES = ["😌", "🙂", "😐", "😣", "🥵"];
export function CrowdReporter({ site }: { site: Site }) {
  const { t, reportCrowd, toast, isLive } = useApp();
  const [sent, setSent] = useState<number | null>(null);
  if (!isLive) return null;
  return (
    <div className="card p-4">
      <p className="mb-2 text-sm font-semibold text-cream">{t("crowd.report")}</p>
      <div className="flex justify-between gap-1">
        {FACES.map((f, i) => (
          <button
            key={f}
            onClick={() => {
              setSent(i + 1);
              reportCrowd(site.id, i + 1);
              toast(t("crowd.reportThanks"));
            }}
            className={`flex h-12 flex-1 items-center justify-center rounded-xl border text-2xl transition active:scale-90 ${
              sent === i + 1 ? "border-gold bg-gold/20" : "border-gold/15 bg-maroon-900/60"
            }`}
            aria-label={`Crowd level ${i + 1} of 5`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SectionHeader({ title, sub, href, icon }: { title: string; sub?: string; href?: string; icon?: React.ReactNode }) {
  const { t } = useApp();
  return (
    <div className="mb-3 flex items-end justify-between px-4">
      <div>
        <h2 className="section-title flex items-center gap-2">
          {icon ?? <Landmark size={16} className="text-gold" />} {title}
        </h2>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="text-xs font-semibold text-gold">
          {t("seeAll")} →
        </Link>
      )}
    </div>
  );
}
