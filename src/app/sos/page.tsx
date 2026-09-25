"use client";

import { useState } from "react";
import { Baby, HeartPulse, Hospital, Loader2, MapPin, Pill, Shield, Siren, UserRound, Users } from "lucide-react";
import { useApp } from "@/lib/store";
import { track } from "@/lib/analytics";
import { TopBar } from "@/components/ui";

const LINES = [
  { num: "108", key: "sos.ambulance", Icon: HeartPulse },
  { num: "1091", key: "sos.women", Icon: UserRound },
  { num: "1363", key: "sos.tourist", Icon: Users },
  { num: "14567", key: "sos.elder", Icon: Shield },
  { num: "1098", key: "sos.child", Icon: Baby },
  { num: "181", key: "sos.women", Icon: UserRound },
];

export default function SosPage() {
  const { t, lang, toast } = useApp();
  const [locating, setLocating] = useState(false);

  const shareLocation = () => {
    if (!navigator.geolocation) return toast("Location not available");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        setLocating(false);
        const url = `https://maps.google.com/?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`;
        const text = `I need help. My live location: ${url}`;
        try {
          if (navigator.share) await navigator.share({ title: "SOS", text });
          else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
        } catch {}
      },
      () => {
        setLocating(false);
        toast("Please allow location access");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const nearest = (q: string) => `https://www.google.com/maps/search/${encodeURIComponent(q)}`;

  return (
    <div className="pb-nav">
      <TopBar title={t("sos.title")} />
      <section className="px-4 pt-4">
        <p className="text-sm text-sand">{t("sos.sub")}</p>
        <a
          href="tel:112"
          onClick={() => track("sos", { lang, meta: { line: "112" } })}
          className="rec-ring mt-4 flex items-center gap-4 rounded-3xl bg-packed p-5 text-white shadow-2xl"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <Siren size={34} />
          </span>
          <span>
            <span className="block font-display text-5xl leading-none">112</span>
            <span className="text-sm font-semibold opacity-90">{t("sos.emergency")}</span>
          </span>
        </a>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {LINES.map(({ num, key, Icon }) => (
            <a key={num} href={`tel:${num}`} onClick={() => track("sos", { lang, meta: { line: num } })} className="card flex items-center gap-3 p-3">
              <Icon size={22} className="shrink-0 text-gold" />
              <span className="min-w-0">
                <span className="block text-xl font-bold text-cream">{num}</span>
                <span className="block text-[10px] leading-tight text-muted">
                  {t(key)}
                </span>
              </span>
            </a>
          ))}
        </div>

        <button onClick={shareLocation} disabled={locating} className="btn-gold mt-4 w-full py-4 text-base">
          {locating ? <Loader2 className="animate-spin" size={19} /> : <MapPin size={19} />} {locating ? t("sos.locating") : t("sos.share")}
        </button>

        <h2 className="section-title mb-2 mt-6">{t("sos.nearest")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { q: "hospital near me", l: t("sos.hospital"), Icon: Hospital },
            { q: "police station near me", l: t("sos.police"), Icon: Shield },
            { q: "pharmacy near me", l: t("sos.pharmacy"), Icon: Pill },
          ].map(({ q, l, Icon }) => (
            <a key={q} href={nearest(q)} target="_blank" rel="noreferrer" className="card flex flex-col items-center gap-1.5 py-4 text-xs font-semibold text-sand">
              <Icon size={24} className="text-teal" /> {l}
            </a>
          ))}
        </div>

        <h2 className="section-title mb-2 mt-6">{t("sos.tips")}</h2>
        <ul className="card space-y-3 p-4">
          {["sos.tip1", "sos.tip2", "sos.tip3", "sos.tip4"].map((k) => (
            <li key={k} className="flex gap-2 text-sm text-sand">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" /> {t(k)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
