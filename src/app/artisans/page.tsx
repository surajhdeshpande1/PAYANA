"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, HandHeart, MapPin, MessageCircle, Navigation, Phone, Store } from "lucide-react";
import { useApp } from "@/lib/store";
import { SAMPLE_ARTISANS } from "@/lib/artisans";
import { getSite, mapsDirUrl, photo } from "@/lib/sites";
import { directionsUrl } from "@/lib/location";
import { sbSelect } from "@/lib/supabase";
import { flushPendingRegistrations } from "@/lib/registrations";
import { track } from "@/lib/analytics";
import { DEMO_STEPS } from "@/lib/demo";
import { TopBar } from "@/components/ui";
import type { Artisan, ArtisanCategory } from "@/lib/types";

const CATS: (ArtisanCategory | "all")[] = ["all", "weaving", "food", "homestay", "crafts", "guide"];
const CAT_IMAGE: Record<ArtisanCategory, string> = {
  weaving: "crafts/handloom",
  food: "crafts/jolada-rotti",
  homestay: "crafts/homestay",
  crafts: "crafts/lambani",
  guide: "sites/aihole",
  other: "crafts/handloom",
};

interface Row {
  id: string;
  name: string;
  craft: string;
  category: ArtisanCategory;
  town: string;
  phone: string | null;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

function waLink(phone: string, text: string) {
  let d = phone.replace(/\D/g, "");
  if (d.length === 10) d = `91${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export default function ArtisansPage() {
  const { t, lang, toast, markArtisanContacted, demoStep } = useApp();
  const [cat, setCat] = useState<ArtisanCategory | "all">("all");
  const [live, setLive] = useState<Artisan[]>([]);
  const demo = demoStep !== null && DEMO_STEPS[demoStep]?.id === "artisans";

  useEffect(() => {
    flushPendingRegistrations();
    sbSelect<Row>("artisans", "select=id,name,craft,category,town,phone,description,address,lat,lng&status=eq.approved&order=created_at.desc&limit=50")
      .then((rows) =>
        setLive(
          rows.map((r) => {
            const same = (s: string) => ({ en: s, kn: s, hi: s });
            return {
              id: `reg-${r.id}`,
              name: same(r.name),
              craft: same(r.craft),
              description: same(r.description || r.craft),
              category: r.category,
              town: r.town,
              nearSite: "",
              // Exact GPS pin if the artisan captured one; otherwise 0 and we route by address.
              lat: r.lat ?? 0,
              lng: r.lng ?? 0,
              address: r.address,
              pinned: r.lat != null && r.lng != null,
              priceHint: "",
              languages: [],
              image: CAT_IMAGE[r.category] ?? "crafts/handloom",
              phone: r.phone,
              registered: true,
            } satisfies Artisan;
          }),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (demo) setCat("weaving");
  }, [demo]);

  useEffect(() => {
    if (window.location.hash) {
      setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, []);

  const list = useMemo(
    () => [...live, ...SAMPLE_ARTISANS].filter((a) => cat === "all" || a.category === cat),
    [live, cat],
  );

  function contact(a: Artisan, how: "call" | "whatsapp" | "directions") {
    track("artisan_contact", { lang, meta: { artisan: a.id, how } });
    markArtisanContacted();
    if (how !== "directions" && !a.phone) toast(t("art.sampleToast"));
  }

  return (
    <div className="pb-nav">
      <TopBar title={t("art.title")} back={false} />

      <section className="px-4 pt-4">
        <div className="card relative overflow-hidden p-4">
          <img src={photo("crafts/ilkal-saree").src} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="relative">
            <HandHeart className="mb-2 text-gold" size={26} />
            <p className="font-serif text-lg leading-snug text-cream">{t("art.sub")}</p>
            <p className="mt-1 text-xs text-sand">
              {list.length} · Ilkal · Guledgudda · Amingad · Badami · Aihole · Pattadakal
            </p>
          </div>
        </div>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 ${cat === c ? "chip-on" : ""}`}>
              {t(`cat.${c}`)}
            </button>
          ))}
        </div>
      </section>

      <ul className="mt-4 space-y-4 px-4">
        {list.map((a, i) => {
          const near = getSite(a.nearSite);
          return (
            <li
              key={a.id}
              id={a.id}
              className={`card scroll-mt-20 overflow-hidden ${demo && i === 0 ? "ring-2 ring-teal" : ""}`}
            >
              <div className="relative h-36">
                <img src={photo(a.image).src} alt="" loading="lazy" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-linear-to-t from-maroon-900 to-transparent" />
                <span
                  className={`absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    a.registered ? "bg-teal text-maroon-950" : "bg-maroon-950/80 text-sand"
                  }`}
                >
                  {a.registered ? <BadgeCheck size={12} /> : null}
                  {a.registered ? t("art.registered") : t("art.sample")}
                </span>
                {a.priceHint && (
                  <span className="absolute bottom-2 right-3 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-maroon-950">
                    {a.priceHint}
                  </span>
                )}
              </div>
              <div className="p-4 pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">{a.craft[lang]}</p>
                <h3 className="text-lg font-semibold leading-snug">{a.name[lang]}</h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                  <MapPin size={12} /> {a.address ? `${a.address}, ${a.town}` : a.town}
                  {near && ` · ${t("art.near")} ${near.name[lang]}`}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-sand">{a.description[lang]}</p>
                {a.languages.length > 0 && (
                  <p className="mt-2 text-[11px] text-muted">
                    {t("art.speaks")}: {a.languages.join(", ")}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a
                    href={a.phone ? `tel:${a.phone}` : undefined}
                    onClick={() => contact(a, "call")}
                    className="btn-ghost cursor-pointer px-2 py-2.5 text-xs"
                  >
                    <Phone size={15} /> {t("art.call")}
                  </a>
                  <a
                    href={a.phone ? waLink(a.phone, `Namaskara! I found you on PAYANA.`) : undefined}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => contact(a, "whatsapp")}
                    className="btn-ghost cursor-pointer px-2 py-2.5 text-xs"
                  >
                    <MessageCircle size={15} /> {t("art.whatsapp")}
                  </a>
                  <a
                    href={a.registered ? directionsUrl({ lat: a.pinned ? a.lat : null, lng: a.pinned ? a.lng : null, address: a.address, town: a.town }) : mapsDirUrl(a.lat, a.lng)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => contact(a, "directions")}
                    className="btn-gold px-2 py-2.5 text-xs"
                  >
                    <Navigation size={15} /> {t("art.directions")}
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="mt-6 px-4">
        <div className="card flex items-center gap-3 border-teal/40 p-4">
          <Store className="shrink-0 text-teal" size={28} />
          <div className="flex-1">
            <p className="text-sm font-semibold">{t("art.cta")}</p>
            <Link href="/artisans/register" className="mt-2 inline-block text-sm font-bold text-teal">
              {t("art.ctaBtn")} →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
