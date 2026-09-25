"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Gem, LocateFixed } from "lucide-react";
import { useApp } from "@/lib/store";
import { SITES, haversineKm, sitePhoto } from "@/lib/sites";
import { LEVEL_COLOR } from "@/lib/crowd";
import { CrowdBadge, TimeMachine, TopBar } from "@/components/ui";
import type { SiteCategory } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="shimmer h-[340px] rounded-2xl" />,
});

type Filter = "all" | "gems" | "temples" | "nature" | "crafts";
const FILTER_CATS: Record<Filter, SiteCategory[] | null> = {
  all: null,
  gems: null,
  temples: ["temple", "cave", "architecture", "fort"],
  nature: ["nature", "lake"],
  crafts: ["crafts"],
};

export default function ExplorePage() {
  const { t, lang, crowd, a11y } = useApp();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [you, setYou] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter") as Filter | null;
    if (f && f in FILTER_CATS) setFilter(f);
  }, []);

  const list = useMemo(() => {
    return SITES.filter((s) => {
      if (filter === "gems") return s.lesserKnown;
      const cats = FILTER_CATS[filter];
      return !cats || cats.some((c) => s.category.includes(c));
    })
      .map((s) => ({ s, c: crowd(s), km: you ? haversineKm(you, s) : null }))
      .sort((a, b) => a.c.pct - b.c.pct);
  }, [filter, crowd, you]);

  const points = list.map(({ s, c }) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    color: LEVEL_COLOR[c.level],
    title: s.name[lang],
    subtitle: `${t(`crowd.${c.level}`)} · ${c.pct}%`,
    gem: s.lesserKnown,
  }));

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setYou({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );

  const labels: Record<Filter, string> = {
    all: t("cat.all"),
    gems: t("site.gem"),
    temples: t("int.temples"),
    nature: t("int.nature"),
    crafts: t("int.crafts"),
  };

  return (
    <div className="pb-nav">
      <TopBar title={t("nav.explore")} back={false} />
      <div className="space-y-3 px-4 pt-3">
        <TimeMachine />
        <div className="relative">
          <MapView points={points} you={you} height={340} onOpen={(id) => router.push(`/site/${id}`)} />
          <button
            onClick={locate}
            className="absolute bottom-3 right-3 z-[500] flex items-center gap-1.5 rounded-full bg-maroon-950/90 px-3 py-2 text-xs font-semibold text-teal shadow-lg"
          >
            <LocateFixed size={14} /> GPS
          </button>
        </div>
        <div className="flex items-center justify-center gap-3 text-[10px] text-muted">
          {(["calm", "moderate", "busy", "packed"] as const).map((l) => (
            <span key={l} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[l] }} /> {t(`crowd.${l}`)}
            </span>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {(Object.keys(FILTER_CATS) as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`chip shrink-0 ${filter === f ? "chip-on" : ""}`}>
              {f === "gems" && <Gem size={12} />} {labels[f]}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-3 px-4">
        {list.map(({ s, c, km }) => (
          <li key={s.id}>
            <Link href={`/site/${s.id}`} className="card flex items-center gap-3 p-2.5">
              <img src={sitePhoto(s.id).src} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-semibold">
                  {s.lesserKnown && <Gem size={13} className="shrink-0 text-gold" />} {s.name[lang]}
                </p>
                <p className="truncate text-xs text-muted">
                  {s.town}
                  {km !== null && ` · ${km.toFixed(1)} km ${t("site.away")}`}
                  {a11y && ` · ♿ ${t(`site.${s.accessibility.level}`)}`}
                </p>
                <div className="mt-1">
                  <CrowdBadge level={c.level} pct={c.pct} small />
                </div>
              </div>
              <span className="text-gold">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
