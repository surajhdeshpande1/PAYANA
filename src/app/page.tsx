"use client";

import Link from "next/link";
import { ArrowDown, Camera, Gem, LayoutDashboard, Mic, QrCode, Route, ShieldAlert, Stamp, Store, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { SITES, haversineKm, sitePhoto } from "@/lib/sites";
import { bestHours, fmtHour, isOpenHour } from "@/lib/crowd";
import { passportPoints } from "@/lib/passport";
import { CrowdBadge, LangSwitch, MenuButton, SectionHeader, SiteCard, TimeMachine } from "@/components/ui";

export default function Home() {
  const { t, lang, crowd, now, stamps, setDemoStep, demoStep } = useApp();
  const open = isOpenHour(now);

  const majors = SITES.filter((s) => !s.lesserKnown)
    .map((s) => ({ s, c: crowd(s) }))
    .sort((a, b) => b.c.pct - a.c.pct);
  const busiest = majors[0];
  const alt = busiest
    ? SITES.filter((s) => s.lesserKnown)
        .map((s) => ({ s, c: crowd(s), km: haversineKm(s, busiest.s) }))
        .sort((a, b) => a.c.pct + a.km * 1.2 - (b.c.pct + b.km * 1.2))[0]
    : undefined;
  const gems = SITES.filter((s) => s.lesserKnown).sort((a, b) => crowd(a).pct - crowd(b).pct);
  const tomorrow = new Date(now);
  if (now.getHours() >= 19) tomorrow.setDate(tomorrow.getDate() + 1);
  const best = busiest ? bestHours(busiest.s, tomorrow) : [];

  const tiles = [
    { href: "/scan", Icon: Camera, title: t("tile.scan"), sub: t("tile.scanSub"), accent: true },
    { href: "/guide?voice=1", Icon: Mic, title: t("tile.ask"), sub: t("tile.askSub") },
    { href: "/trip", Icon: Route, title: t("tile.plan"), sub: t("tile.planSub") },
    { href: "/artisans", Icon: Store, title: t("tile.artisans"), sub: t("tile.artisansSub") },
  ];

  return (
    <div className="pb-nav">
      {/* Hero */}
      <section className="relative h-[330px] overflow-hidden">
        <img src="/images/hero.jpg" alt="Agastya lake and Bhutanatha temples, Badami" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-maroon-950/65 via-maroon-950/45 to-maroon-950" />
        <div className="relative flex items-center justify-between px-4 pt-4">
          <span className="flex items-center gap-2 rounded-full border border-gold/30 bg-maroon-950/60 py-1 pl-1 pr-3 backdrop-blur">
            <img src="/icons/icon-192.png" alt="" className="h-7 w-7 rounded-full" />
            <span className="text-xs font-semibold tracking-wide text-gold-light">ಪಯಣ · PAYANA</span>
          </span>
          <div className="flex items-center gap-2">
            <LangSwitch compact />
            <MenuButton />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-12 px-5">
          <p className="font-serif text-[26px] font-medium italic text-white drop-shadow">{t("greeting")}</p>
          <h1 className="gold-text font-display text-[60px] font-semibold leading-none tracking-[0.14em] drop-shadow-lg">PAYANA</h1>
          <div className="hairline my-2 w-40 from-gold/80" />
          <p className="max-w-[20rem] text-[13px] uppercase tracking-[0.18em] text-cream/85">{t("tagline")}</p>
        </div>
      </section>

      {/* Live crowd banner */}
      <section className="relative z-10 -mt-9 px-4">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-packed opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-packed" />
              </span>
              {t("crowd.live")}
            </h2>
            <Link href="/explore" className="text-xs font-semibold text-gold-light">
              {t("seeAll")} →
            </Link>
          </div>
          <TimeMachine />
          {open && busiest && alt ? (
            <div className="mt-3 space-y-2">
              <Link href={`/site/${busiest.s.id}`} className="flex items-center gap-3 rounded-xl bg-maroon-900/70 p-2.5">
                <img src={sitePhoto(busiest.s.id).src} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{busiest.s.name[lang]}</p>
                  <CrowdBadge level={busiest.c.level} pct={busiest.c.pct} small />
                </div>
              </Link>
              {busiest.c.level === "busy" || busiest.c.level === "packed" ? (
                <>
                  <div className="flex items-center gap-2 pl-6 text-xs font-semibold text-teal">
                    <ArrowDown size={14} /> {t("crowd.tryInstead")} · {alt.km.toFixed(0)} km
                  </div>
                  <Link
                    href={`/site/${alt.s.id}`}
                    className="flex items-center gap-3 rounded-xl border border-teal/40 bg-teal/10 p-2.5"
                  >
                    <img src={sitePhoto(alt.s.id).src} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        <Gem size={13} className="text-gold" /> {alt.s.name[lang]}
                      </p>
                      <CrowdBadge level={alt.c.level} pct={alt.c.pct} small />
                    </div>
                    <span className="text-xs font-bold text-teal">{t("open")} →</span>
                  </Link>
                </>
              ) : (
                <p className="pl-1 text-xs font-medium text-calm">✓ {t("crowd.allCalm")}</p>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-maroon-900/70 p-3 text-sm">
              <p className="font-semibold text-cream">{t("crowd.closed")}</p>
              {busiest && best.length > 0 && (
                <p className="mt-1 text-xs text-sand">
                  {t("crowd.bestTime")} · {busiest.s.name[lang]}: <b className="text-teal">{fmtHour(best[0])}</b>
                </p>
              )}
            </div>
          )}
          <p className="mt-3 text-[10px] leading-snug text-muted">{t("crowd.model")}</p>
        </div>
      </section>

      {/* Tiles */}
      <section className="mt-5 grid grid-cols-2 gap-3 px-4">
        {tiles.map(({ href, Icon, title, sub, accent }) => (
          <Link
            key={href}
            href={href}
            className={`card relative flex min-h-[132px] flex-col justify-between overflow-hidden p-4 transition active:scale-[0.97] ${
              accent ? "border-gold/50" : ""
            }`}
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                accent ? "text-maroon-950" : "bg-maroon-700/80 text-gold-light"
              }`}
              style={accent ? { background: "linear-gradient(180deg,#ffffff,#f1e7d8)" } : undefined}
            >
              <Icon size={22} />
            </span>
            <span>
              <span className="block text-[15px] font-semibold leading-tight text-cream">{title}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">{sub}</span>
            </span>
          </Link>
        ))}
      </section>

      {demoStep === null && (
        <section className="mt-4 px-4">
          <button onClick={() => setDemoStep(0)} className="flex w-full items-center gap-3 rounded-2xl border border-teal/40 bg-teal/10 px-4 py-3 text-left">
            <Sparkles size={20} className="text-teal" />
            <span className="flex-1 text-sm font-semibold text-cream">{t("menu.demo")}</span>
            <span className="text-xs text-teal">3 min →</span>
          </button>
        </section>
      )}

      {/* Hidden gems */}
      <section className="mt-7">
        <SectionHeader title={t("home.hiddenGems")} sub={t("home.hiddenGemsSub")} icon={<Gem size={16} className="text-gold" />} href="/explore?filter=gems" />
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
          {gems.map((s) => (
            <SiteCard key={s.id} site={s} />
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="mt-7 px-4">
        <h2 className="section-title mb-3">{t("home.more")}</h2>
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: "/passport", Icon: Stamp, label: t("pass.title"), badge: passportPoints(stamps) || undefined },
            { href: "/sos", Icon: ShieldAlert, label: "SOS", danger: true },
            { href: "/admin", Icon: LayoutDashboard, label: t("menu.dashboard") },
            { href: "/share", Icon: QrCode, label: "QR" },
          ].map(({ href, Icon, label, badge, danger }) => (
            <Link key={href} href={href} className="card relative flex flex-col items-center gap-1.5 px-1 py-3 text-center">
              <Icon size={22} className={danger ? "text-packed" : "text-gold"} />
              <span className="line-clamp-2 text-[10px] font-medium leading-tight text-sand">{label}</span>
              {badge !== undefined && (
                <span className="absolute -right-1 -top-1 rounded-full bg-teal px-1.5 text-[10px] font-bold text-maroon-950">{badge}</span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* All sites */}
      <section className="mt-7">
        <SectionHeader title={t("home.allSites")} href="/explore" />
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
          {SITES.filter((s) => !s.lesserKnown).map((s) => (
            <SiteCard key={s.id} site={s} />
          ))}
        </div>
      </section>

      <footer className="mt-8 px-6 text-center text-[10px] leading-relaxed text-muted">
        <div className="divider-ornament mb-3 text-xs">◆</div>
        {t("home.footer")}
        <br />
        Badami · Aihole · Pattadakal · Mahakuta · Banashankari · Kudalasangama
      </footer>
    </div>
  );
}
