"use client";

import Link from "next/link";
import { Gem, Lock, Share2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { SITES, sitePhoto } from "@/lib/sites";
import { TOTAL_SITES, badges, passportPoints } from "@/lib/passport";
import { TopBar } from "@/components/ui";

export default function PassportPage() {
  const { t, lang, stamps, artisanContacted, crowdReported } = useApp();
  const points = passportPoints(stamps);
  const count = Object.keys(stamps).length;
  const bs = badges(stamps, { artisanContacted, crowdReported });

  const share = async () => {
    const text = `🏛️ My PAYANA Heritage Passport: ${count}/${TOTAL_SITES} Bagalkote sites, ${points} points! ${typeof window !== "undefined" ? window.location.origin : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: "PAYANA", text });
      else await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <div className="pb-nav">
      <TopBar title={t("pass.title")} />

      <section className="px-4 pt-4">
        <div
          className="relative overflow-hidden rounded-3xl border-2 border-gold/60 p-5 shadow-2xl"
          style={{ background: "linear-gradient(135deg,#5e2416 0%,#35120c 60%,#260c08 100%)" }}
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[14px] border-gold/10" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold/80">Bagalkote · ಬಾಗಲಕೋಟೆ</p>
          <h2 className="gold-text font-display text-3xl tracking-wider">HERITAGE PASSPORT</h2>
          <p className="font-serif text-sm italic text-sand">ಪರಂಪರೆ ಪಾಸ್‌ಪೋರ್ಟ್ · विरासत पासपोर्ट</p>
          <div className="mt-5 flex items-end gap-6">
            <div>
              <p className="font-display text-5xl text-cream">{points}</p>
              <p className="text-xs text-muted">{t("pass.points")}</p>
            </div>
            <div>
              <p className="font-display text-3xl text-cream">
                {count}
                <span className="text-lg text-muted">/{TOTAL_SITES}</span>
              </p>
              <p className="text-xs text-muted">{t("pass.stamps")}</p>
            </div>
            <button onClick={share} className="btn-ghost ml-auto px-3 py-2 text-xs">
              <Share2 size={14} /> {t("pass.share")}
            </button>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-maroon-950/70">
            <div className="h-full rounded-full bg-linear-to-r from-gold-dark via-gold to-gold-light transition-all" style={{ width: `${(count / TOTAL_SITES) * 100}%` }} />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-gold-light">
            <Gem size={12} /> {t("pass.hint")}
          </p>
        </div>
        <p className="mt-3 text-xs text-muted">{t("pass.howTo")}</p>
      </section>

      <section className="mt-5 px-4">
        <h2 className="section-title mb-3">{t("pass.stamps")}</h2>
        <div className="grid grid-cols-3 gap-3">
          {SITES.map((s) => {
            const at = stamps[s.id];
            return (
              <Link key={s.id} href={`/site/${s.id}`} className="flex flex-col items-center text-center">
                <div className={`relative h-24 w-24 overflow-hidden rounded-full border-4 ${at ? "border-gold" : "border-maroon-600 border-dashed"}`}>
                  <img
                    src={sitePhoto(s.id).src}
                    alt=""
                    loading="lazy"
                    className={`h-full w-full object-cover ${at ? "" : "opacity-25 grayscale"}`}
                  />
                  {at ? (
                    <span className="stamp-in absolute inset-0 flex items-center justify-center">
                      <span className="rounded-md border-2 border-packed bg-maroon-950/40 px-1.5 py-0.5 text-[9px] font-black uppercase text-packed">
                        {new Date(at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </span>
                    </span>
                  ) : (
                    <Lock size={16} className="absolute inset-0 m-auto text-sand/60" />
                  )}
                  {s.lesserKnown && (
                    <span className="absolute bottom-0 right-1 text-sm" title="2×">
                      💎
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-sand">{s.name[lang]}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="section-title mb-3">{t("pass.badges")}</h2>
        <div className="space-y-2">
          {bs.map((b) => (
            <div key={b.key} className={`card flex items-center gap-3 p-3 ${b.earned ? "border-gold/60" : "opacity-60"}`}>
              <span className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl ${b.earned ? "bg-gold/20" : "bg-maroon-900 grayscale"}`}>
                {b.icon}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{t(`badge.${b.key}`)}</p>
                <p className="text-xs text-muted">{t(`badge.${b.key}D`)}</p>
              </div>
              <span className="text-xs font-bold text-gold">{b.earned ? "✓" : b.progress || <Lock size={14} />}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
