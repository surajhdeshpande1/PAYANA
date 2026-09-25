"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Loader2, LocateFixed, MapPin, Send, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { sbInsert } from "@/lib/supabase";
import { PENDING_REG_KEY } from "@/lib/registrations";
import { currentPosition, mapSearchUrl } from "@/lib/location";
import { track } from "@/lib/analytics";
import { TopBar } from "@/components/ui";
import type { ArtisanCategory } from "@/lib/types";

const CATS: ArtisanCategory[] = ["weaving", "food", "homestay", "crafts", "guide", "other"];

export default function RegisterPage() {
  const { t, lang } = useApp();
  const [f, setF] = useState({
    name: "",
    craft: "",
    category: "weaving" as ArtisanCategory,
    town: "",
    address: "",
    phone: "",
    description: "",
  });
  const [pin, setPin] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsErr, setGpsErr] = useState(false);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "queued">("idle");
  const [err, setErr] = useState("");

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  async function useGps() {
    setGpsErr(false);
    setLocating(true);
    try {
      setPin(await currentPosition());
    } catch {
      setGpsErr(true);
    }
    setLocating(false);
  }

  const place = { town: f.town, address: f.address, lat: pin?.lat, lng: pin?.lng };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const phone = f.phone.replace(/[^\d+]/g, "");
    if (f.name.trim().length < 2 || f.craft.trim().length < 2 || f.town.trim().length < 2) {
      setErr("Please fill name, craft and town / village.");
      return;
    }
    if (phone && (phone.replace(/\D/g, "").length < 10 || phone.length > 14)) {
      setErr("Please enter a valid 10-digit phone number.");
      return;
    }
    const row = {
      name: f.name.trim().slice(0, 80),
      craft: f.craft.trim().slice(0, 80),
      category: f.category,
      town: f.town.trim().slice(0, 60),
      address: f.address.trim().slice(0, 200) || null,
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
      phone: phone || null,
      description: f.description.trim().slice(0, 500) || null,
    };
    setState("sending");
    try {
      await sbInsert("artisans", row);
      track("register", { lang, meta: { category: f.category, gps: Boolean(pin) } });
      setState("done");
    } catch {
      try {
        const q = JSON.parse(localStorage.getItem(PENDING_REG_KEY) || "[]");
        q.push(row);
        localStorage.setItem(PENDING_REG_KEY, JSON.stringify(q));
      } catch {}
      setState("queued");
    }
  }

  if (state === "done" || state === "queued") {
    return (
      <div className="pb-nav">
        <TopBar title={t("reg.title")} />
        <div className="fade-up flex flex-col items-center px-8 pt-16 text-center">
          <CheckCircle2 size={64} className="text-teal" />
          <p className="mt-4 font-serif text-xl text-gold-light">{t(state === "done" ? "reg.done" : "reg.queued")}</p>
          <Link href="/artisans" className="btn-gold mt-8">
            {t("nav.artisans")} →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-nav">
      <TopBar title={t("reg.title")} />
      <form onSubmit={submit} className="space-y-4 px-4 pt-4">
        <p className="text-sm text-sand">{t("reg.sub")}</p>
        <label className="block">
          <span className="label">{t("reg.name")} *</span>
          <input className="input" value={f.name} onChange={set("name")} maxLength={80} required />
        </label>
        <label className="block">
          <span className="label">{t("reg.craft")} *</span>
          <input className="input" value={f.craft} onChange={set("craft")} maxLength={80} placeholder="Ilkal sarees, jolada rotti meals, homestay…" required />
        </label>
        <label className="block">
          <span className="label">{t("reg.category")}</span>
          <select className="input" value={f.category} onChange={set("category")}>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {t(`cat.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{t("reg.town")} *</span>
          <input className="input" value={f.town} onChange={set("town")} maxLength={60} placeholder="Ilkal / Guledgudda / Amingad…" required />
        </label>
        <label className="block">
          <span className="label">{t("reg.address")}</span>
          <input className="input" value={f.address} onChange={set("address")} maxLength={200} placeholder={t("reg.addressPh")} />
        </label>

        {/* Location on the map */}
        <div className="card space-y-3 p-4">
          <p className="label mb-0 flex items-center gap-1.5">
            <MapPin size={12} /> {t("reg.location")}
          </p>
          {pin ? (
            <div className="flex items-center gap-2 rounded-xl border border-teal/40 bg-teal/10 p-3 text-sm">
              <LocateFixed size={18} className="shrink-0 text-teal" />
              <span className="flex-1">
                <b className="text-teal">{t("reg.gpsOk")}</b>
                <span className="block text-[11px] text-sand">
                  {pin.lat}, {pin.lng} · ±{pin.accuracy} m
                </span>
              </span>
              <button type="button" onClick={() => setPin(null)} className="rounded-full p-1 text-muted" aria-label={t("reg.clearGps")}>
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <button type="button" onClick={useGps} disabled={locating} className="btn-ghost w-full">
                {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}{" "}
                {locating ? t("reg.locating") : t("reg.useGps")}
              </button>
              <p className="text-[11px] leading-snug text-muted">
                {t("reg.gpsHint")} {t("reg.noGps")}
              </p>
            </>
          )}
          {gpsErr && <p className="text-xs text-packed">{t("reg.gpsFail")}</p>}
          {(pin || f.town.trim().length >= 2) && (
            <a href={mapSearchUrl(place)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-semibold text-gold">
              <ExternalLink size={14} /> {t("reg.checkMap")}
            </a>
          )}
        </div>

        <label className="block">
          <span className="label">{t("reg.phone")}</span>
          <input className="input" value={f.phone} onChange={set("phone")} inputMode="tel" maxLength={14} placeholder="98xxxxxxxx" />
        </label>
        <label className="block">
          <span className="label">{t("reg.desc")}</span>
          <textarea className="input min-h-24" value={f.description} onChange={set("description")} maxLength={500} />
        </label>
        <label className="flex items-start gap-3 text-sm text-sand">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[#d9b36c]" />
          {t("reg.consent")}
        </label>
        {err && <p className="text-sm text-packed">{err}</p>}
        <button type="submit" disabled={!consent || state === "sending"} className="btn-gold w-full py-4">
          {state === "sending" ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} {t("reg.submit")}
        </button>
      </form>
    </div>
  );
}
