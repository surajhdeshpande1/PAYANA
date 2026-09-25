"use client";

import { LANGS } from "@/lib/i18n";
import { useApp } from "@/lib/store";

const GREETING = { kn: "ನಮಸ್ಕಾರ", hi: "नमस्कार", en: "Welcome" } as const;

export default function LanguagePicker() {
  const { setLang } = useApp();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-maroon-950/96 px-6 backdrop-blur-md">
      <div className="fade-up w-full max-w-sm text-center">
        <img src="/icons/icon-192.png" alt="" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-xl" />
        <p className="font-serif text-base italic text-sand">ಪಯಣ · पयण</p>
        <h1 className="gold-text font-display text-5xl tracking-wide">PAYANA</h1>
        <p className="mt-2 text-sm text-sand">Choose your language · ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ · भाषा चुनें</p>
        <div className="mt-7 space-y-3">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className="card flex w-full items-center justify-between px-5 py-4 text-left transition active:scale-[0.98] hover:border-gold/60"
            >
              <span>
                <span className="block text-xl font-semibold text-cream">{l.native}</span>
                <span className="text-xs text-muted">{l.label}</span>
              </span>
              <span className="font-serif text-lg italic text-gold">{GREETING[l.code]}</span>
            </button>
          ))}
        </div>
        <p className="mt-6 text-[11px] text-muted">
          AI guide · crowd-smart trips · local artisans — Bagalkote district
        </p>
      </div>
    </div>
  );
}
