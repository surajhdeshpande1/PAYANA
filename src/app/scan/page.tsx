"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Camera, ImagePlus, MessageCircle, RotateCcw, Stamp } from "lucide-react";
import { useApp } from "@/lib/store";
import { SITES, getSite, sitePhoto } from "@/lib/sites";
import { askGuide, crowdSnapshot } from "@/lib/guide-client";
import { compressImage, urlToBlob } from "@/lib/media";
import { speak } from "@/lib/tts";
import { track } from "@/lib/analytics";
import { DEMO_SCAN_SITE, DEMO_STEPS } from "@/lib/demo";
import { CrowdReporter, SpeakButton, TopBar } from "@/components/ui";
import type { GuideResponse } from "@/lib/types";

const SAMPLES = ["mahakuta", "pattadakal", "badami-caves", "aihole"];

export default function ScanPage() {
  const { t, lang, crowd, stamp, stamps, toast, demoStep } = useApp();
  const [phase, setPhase] = useState<"idle" | "analyzing" | "result">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<GuideResponse | null>(null);
  const [justStamped, setJustStamped] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const demoRan = useRef(false);

  async function analyze(blob: Blob, expected?: string, cachedOnly = false) {
    setPhase("analyzing");
    setResult(null);
    setJustStamped(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const img = await compressImage(blob);
      setPreview(img.dataUrl);
      let res: GuideResponse;
      const cached = (id: string): GuideResponse => ({
        answer: getSite(id)!.story[lang],
        siteId: id,
        confidence: 0.94,
        provider: "demo",
      });
      if (cachedOnly && expected) {
        await new Promise((r) => setTimeout(r, 1400)); // let the scan animation play
        res = cached(expected);
      } else {
        res = await askGuide({
          mode: "scan",
          lang,
          messages: [],
          image: { data: img.base64, mime: img.mime },
          crowd: crowdSnapshot(crowd),
        });
        // Known sample photo but AI unavailable → use the verified cached narration.
        if (expected && (res.provider === "offline" || !res.siteId)) res = cached(expected);
      }
      setResult(res);
      setPhase("result");
      track("scan", { siteId: res.siteId, lang, meta: { provider: res.provider, confidence: res.confidence ?? null } });
      if (res.siteId) speak("scan-result", res.answer, lang);
    } catch {
      toast(t("scan.error"));
      setPhase("idle");
    }
  }

  async function runSample(id: string, cachedOnly = false) {
    const blob = await urlToBlob(sitePhoto(id).src);
    analyze(blob, id, cachedOnly);
  }

  // Demo tour: auto-scan Mahakuta with the cached answer (works with no internet).
  useEffect(() => {
    if (demoStep === null || demoRan.current) return;
    if (DEMO_STEPS[demoStep]?.id === "scan") {
      demoRan.current = true;
      runSample(DEMO_SCAN_SITE, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoStep]);

  const site = getSite(result?.siteId);
  const conf = Math.round((result?.confidence ?? 0.9) * 100);

  function collect() {
    if (!site) return;
    stamp(site.id);
    setJustStamped(true);
    toast(`${t("site.stamped")} · +${site.lesserKnown ? 20 : 10}`);
  }

  return (
    <div className="pb-nav">
      <TopBar title={t("scan.title")} />

      <div className="px-4 pt-4">
        {/* Viewfinder */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-gold/30 bg-maroon-900">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <Camera size={44} className="text-gold/70" />
              <p className="text-sm text-sand">{t("scan.hint")}</p>
            </div>
          )}
          {/* corner brackets */}
          {["left-3 top-3 border-l-2 border-t-2", "right-3 top-3 border-r-2 border-t-2", "left-3 bottom-3 border-l-2 border-b-2", "right-3 bottom-3 border-r-2 border-b-2"].map((c) => (
            <span key={c} className={`absolute h-8 w-8 rounded-sm border-gold ${c}`} />
          ))}
          {phase === "analyzing" && (
            <>
              <div className="absolute inset-0 bg-maroon-950/35" />
              <div className="scanline absolute inset-x-4 h-0.5 bg-gold shadow-[0_0_18px_4px_rgba(232,180,90,0.7)]" />
              <div className="absolute inset-x-0 bottom-4 text-center">
                <span className="rounded-full bg-maroon-950/85 px-4 py-2 text-sm font-semibold text-gold-light">{t("scan.analyzing")}</span>
              </div>
            </>
          )}
          {phase === "result" && site && (
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-2xl bg-maroon-950/85 px-3 py-2 backdrop-blur">
              <BadgeCheck className="shrink-0 text-teal" size={22} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-teal">{t("scan.recognised")}</p>
                <p className="truncate font-semibold text-cream">{site.name[lang]}</p>
              </div>
              <div className="w-16 text-right">
                <p className="text-sm font-bold text-gold">{conf}%</p>
                <div className="h-1 rounded-full bg-maroon-600">
                  <div className="h-1 rounded-full bg-teal" style={{ width: `${conf}%` }} />
                </div>
                <p className="text-[9px] text-muted">{t("scan.confidence")}</p>
              </div>
            </div>
          )}
          {justStamped && site && (
            <div className="stamp-in absolute right-5 top-5 flex h-24 w-24 items-center justify-center rounded-full border-4 border-double border-packed/90 text-center text-[10px] font-black uppercase leading-tight text-packed/90">
              {site.name.en}
              <br />★ PAYANA ★
            </div>
          )}
        </div>

        {/* Actions */}
        {phase !== "analyzing" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => camRef.current?.click()} className="btn-gold py-3.5">
              <Camera size={19} /> {phase === "result" ? t("scan.again") : t("scan.camera")}
            </button>
            <button onClick={() => galRef.current?.click()} className="btn-ghost py-3.5">
              <ImagePlus size={19} /> {t("scan.upload")}
            </button>
          </div>
        )}
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) analyze(f); e.target.value = ""; }} />
        <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) analyze(f); e.target.value = ""; }} />

        {/* Result */}
        {phase === "result" && result && (
          <div className="fade-up mt-5 space-y-4">
            {site ? (
              <div className="card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-serif text-xl font-semibold text-gold-light">{site.name[lang]}</h2>
                  <SpeakButton id="scan-result" text={result.answer} />
                </div>
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-cream/95">{result.answer}</p>
                <p className="mt-3 flex items-center gap-1 text-[10px] text-muted">
                  <BadgeCheck size={11} className="text-teal" /> {result.provider === "demo" ? "Demo · verified cached narration" : t("guide.grounded")}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={collect} disabled={Boolean(stamps[site.id]) && !justStamped} className="btn-gold">
                    <Stamp size={17} /> {stamps[site.id] ? "✓ " : ""}{t("scan.stamp")}
                  </button>
                  <Link href={`/guide?site=${site.id}`} className="btn-ghost">
                    <MessageCircle size={17} /> {t("scan.followUp")}
                  </Link>
                  <Link href={`/site/${site.id}`} className="btn-ghost col-span-2">
                    {t("scan.openSite")} →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card p-4">
                <p className="text-sm leading-relaxed">{result.answer}</p>
                <p className="mt-3 text-sm font-semibold text-gold-light">{t("scan.notSure")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SITES.map((s) => (
                    <button
                      key={s.id}
                      className="chip"
                      onClick={() => {
                        setResult({ answer: s.story[lang], siteId: s.id, confidence: 1, provider: "offline" });
                        speak("scan-result", s.story[lang], lang);
                      }}
                    >
                      {s.name[lang]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {site && <CrowdReporter site={site} />}
            <button
              onClick={() => {
                setPhase("idle");
                setPreview(null);
                setResult(null);
              }}
              className="mx-auto flex items-center gap-1.5 text-xs text-muted"
            >
              <RotateCcw size={13} /> {t("scan.again")}
            </button>
          </div>
        )}

        {/* Samples */}
        {phase === "idle" && (
          <div className="mt-6">
            <p className="mb-2 text-xs text-muted">{t("scan.samples")}</p>
            <div className="grid grid-cols-4 gap-2">
              {SAMPLES.map((id) => (
                <button key={id} onClick={() => runSample(id)} className="group overflow-hidden rounded-xl border border-gold/20">
                  <img src={sitePhoto(id).src} alt={getSite(id)?.name.en} className="aspect-square w-full object-cover transition group-active:scale-95" />
                  <span className="block truncate bg-maroon-800 px-1 py-1 text-[9px] text-sand">{getSite(id)?.name[lang]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
