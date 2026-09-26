"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  BadgeCheck,
  Car,
  ChevronLeft,
  Clock,
  Gem,
  Hourglass,
  MessageCircle,
  Navigation,
  Stamp,
  Sun,
  Ticket,
  Toilet,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { useBuiltinArtisans } from "@/lib/registrations";
import { SITES, getSite, haversineKm, mapsDirUrl, photo, sitePhoto } from "@/lib/sites";
import { bestHours, fmtHour } from "@/lib/crowd";
import { CrowdBadge, CrowdChart, CrowdReporter, LangSwitch, MenuButton, SiteCard, SpeakButton } from "@/components/ui";

export default function SiteDetail({ id }: { id: string }) {
  const site = getSite(id)!;
  const router = useRouter();
  const { t, lang, crowd, now, stamps, stamp, toast, a11y } = useApp();
  const c = crowd(site);
  const ph = sitePhoto(site.id);
  const best = bestHours(site, now);
  const stamped = Boolean(stamps[site.id]);

  const builtins = useBuiltinArtisans();
  const artisans = builtins.filter((a) => a.nearSite === site.id || haversineKm(a, site) < 6).slice(0, 6);
  const gems = SITES.filter((s) => s.id !== site.id && s.lesserKnown)
    .map((s) => ({ s, km: haversineKm(s, site) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 4);

  const accColor = { good: "text-calm", partial: "text-moderate", difficult: "text-packed" }[site.accessibility.level];

  return (
    <div className="pb-nav">
      {/* Hero */}
      <section className="relative h-[300px]">
        <img src={ph.src} alt={site.name.en} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-maroon-950/60 via-transparent to-maroon-950" />
        <div className="relative flex items-center justify-between px-3 pt-3">
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/explore"))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-maroon-950/70 text-gold-light backdrop-blur"
            aria-label={t("back")}
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex items-center gap-2">
            <LangSwitch compact />
            <MenuButton />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-3 px-4">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {site.unesco && <span className="rounded-full bg-teal px-2.5 py-0.5 text-[10px] font-bold text-maroon-950">{t("site.unesco")}</span>}
            {site.lesserKnown && (
              <span className="flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold text-maroon-950">
                <Gem size={10} /> {t("site.gem")} · 2×
              </span>
            )}
            <CrowdBadge level={c.level} pct={c.pct} small />
          </div>
          <h1 className="font-serif text-3xl font-bold leading-tight text-cream drop-shadow">{site.name[lang]}</h1>
          <p className="text-sm italic text-gold-light">{site.tagline[lang]}</p>
        </div>
      </section>
      {ph.author && (
        <p className="px-4 pt-1 text-right text-[9px] text-muted">
          📷 {ph.author} · {ph.license} ·{" "}
          <a href={ph.source} target="_blank" rel="noreferrer" className="underline">
            Wikimedia Commons
          </a>
        </p>
      )}

      {/* Actions */}
      <section className="mt-3 grid grid-cols-4 gap-2 px-4">
        <a href={mapsDirUrl(site.lat, site.lng)} target="_blank" rel="noreferrer" className="card flex flex-col items-center gap-1 py-3 text-[11px] font-semibold text-sand">
          <Navigation size={20} className="text-gold" /> {t("site.navigate")}
        </a>
        <Link href={`/guide?site=${site.id}`} className="card flex flex-col items-center gap-1 py-3 text-[11px] font-semibold text-sand">
          <MessageCircle size={20} className="text-gold" /> {t("nav.guide")}
        </Link>
        <Link href="/scan" className="card flex flex-col items-center gap-1 py-3 text-[11px] font-semibold text-sand">
          <BadgeCheck size={20} className="text-gold" /> {t("nav.scan")}
        </Link>
        <button
          onClick={() => {
            if (!stamped) {
              stamp(site.id);
              toast(`${t("site.stamped")} · +${site.lesserKnown ? 20 : 10}`);
            }
          }}
          className={`card flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${stamped ? "border-teal/60 text-teal" : "text-sand"}`}
        >
          <Stamp size={20} className={stamped ? "text-teal" : "text-gold"} /> {stamped ? "✓" : t("pass.stamps")}
        </button>
      </section>

      {/* Story */}
      <section className="mt-5 px-4">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="section-title">{t("site.story")}</h2>
            <SpeakButton id={`story-${site.id}`} text={site.story[lang]} title={site.name[lang]} href={`/site/${site.id}`} />
          </div>
          <p className="text-[15px] leading-relaxed text-cream/95">{site.story[lang]}</p>
        </div>
      </section>

      {/* Crowd forecast */}
      <section className="mt-4 px-4">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">{t("crowd.forecast")}</h2>
            {c.reports > 0 && <span className="text-[10px] text-teal">● {c.reports} {t("crowd.reports")}</span>}
          </div>
          <CrowdChart site={site} day={now} highlight={now.getHours()} />
          {best.length > 0 && (
            <p className="mt-3 text-sm">
              <span className="text-muted">{t("crowd.bestTime")}: </span>
              <b className="text-teal">{best.slice(0, 3).map(fmtHour).join(", ")}</b>
            </p>
          )}
          <p className="mt-2 text-[10px] text-muted">{t("crowd.model")}</p>
        </div>
      </section>

      <section className="mt-4 px-4">
        <CrowdReporter site={site} />
      </section>

      {/* Visit info */}
      <section className="mt-4 px-4">
        <h2 className="section-title mb-2">{t("site.visit")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { Icon: Clock, l: t("site.timings"), v: site.timings },
            { Icon: Ticket, l: t("site.entry"), v: site.entryFee },
            { Icon: Hourglass, l: t("site.duration"), v: `${site.visitMinutes} ${t("trip.min")}` },
            { Icon: Sun, l: t("site.best"), v: site.bestTime },
          ].map(({ Icon, l, v }) => (
            <div key={l} className="card p-3">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gold/80">
                <Icon size={12} /> {l}
              </p>
              <p className="mt-1 text-xs leading-snug text-cream">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Accessibility */}
      <section className="mt-4 px-4">
        <div className={`card p-4 ${a11y ? "border-teal/60" : ""}`}>
          <h2 className="section-title flex items-center gap-2">
            <Accessibility size={18} className="text-teal" /> {t("site.access")}
          </h2>
          <p className={`mt-1 text-sm font-semibold ${accColor}`}>
            {t(`site.${site.accessibility.level}`)} · ~{site.accessibility.steps} {t("site.steps")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-sand">{site.accessibility.notes}</p>
          <div className="mt-2 flex gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Toilet size={13} /> {t("site.toilets")} {site.accessibility.toilets ? "✓" : "✗"}
            </span>
            <span className="flex items-center gap-1">
              <Car size={13} /> {t("site.parking")} {site.accessibility.parking ? "✓" : "✗"}
            </span>
          </div>
        </div>
      </section>

      {/* Facts */}
      <section className="mt-4 px-4">
        <div className="card p-4">
          <h2 className="section-title">{t("site.facts")}</h2>
          {lang !== "en" && <p className="text-[10px] text-muted">{t("site.factsEn")}</p>}
          <ul className="mt-2 space-y-2">
            {site.facts.map((f) => (
              <li key={f} className="flex gap-2 text-[13px] leading-snug text-sand">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" /> {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Nearby artisans */}
      {artisans.length > 0 && (
        <section className="mt-6">
          <h2 className="section-title mb-3 px-4">{t("site.nearbyArt")}</h2>
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-4">
            {artisans.map((a) => (
              <Link key={a.id} href={`/artisans#${a.id}`} className="card w-44 shrink-0 overflow-hidden">
                <img src={photo(a.image).src} alt="" loading="lazy" className="h-24 w-full object-cover" />
                <div className="p-2.5">
                  <p className="text-[10px] font-semibold uppercase text-gold">{a.craft[lang]}</p>
                  <p className="line-clamp-2 text-xs font-semibold">{a.name[lang]}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Hidden gems nearby */}
      <section className="mt-6">
        <h2 className="section-title mb-3 flex items-center gap-2 px-4">
          <Gem size={16} className="text-gold" /> {t("home.hiddenGems")}
        </h2>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4">
          {gems.map(({ s }) => (
            <SiteCard key={s.id} site={s} />
          ))}
        </div>
      </section>

      {site.sources && site.sources.length > 0 && (
        <details className="mx-4 mt-6 text-xs text-muted">
          <summary className="cursor-pointer">{t("site.sources")} ({site.sources.length})</summary>
          <ul className="mt-2 space-y-1 break-all">
            {site.sources.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer" className="underline">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
