"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useApp } from "@/lib/store";
import { sbInsert } from "@/lib/supabase";
import { PENDING_REG_KEY } from "@/lib/registrations";
import { track } from "@/lib/analytics";
import { TopBar } from "@/components/ui";
import type { ArtisanCategory } from "@/lib/types";

const CATS: ArtisanCategory[] = ["weaving", "food", "homestay", "crafts", "guide", "other"];

export default function RegisterPage() {
  const { t, lang } = useApp();
  const [f, setF] = useState({ name: "", craft: "", category: "weaving" as ArtisanCategory, town: "", phone: "", description: "" });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "queued">("idle");
  const [err, setErr] = useState("");

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const phone = f.phone.replace(/[^\d+]/g, "");
    if (f.name.trim().length < 2 || f.craft.trim().length < 2 || f.town.trim().length < 2) {
      setErr("Please fill name, craft and town.");
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
      phone: phone || null,
      description: f.description.trim().slice(0, 500) || null,
    };
    setState("sending");
    try {
      await sbInsert("artisans", row);
      track("register", { lang, meta: { category: f.category } });
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
        <div className="grid grid-cols-2 gap-3">
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
            <input className="input" value={f.town} onChange={set("town")} maxLength={60} placeholder="Ilkal" required />
          </label>
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
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[#e8b45a]" />
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
