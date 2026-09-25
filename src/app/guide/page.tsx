"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ImagePlus, Loader2, Mic, Send, Square, WifiOff, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { getSite, sitePhoto } from "@/lib/sites";
import { askGuide, crowdSnapshot } from "@/lib/guide-client";
import { VoiceRecorder, compressImage } from "@/lib/media";
import { speak } from "@/lib/tts";
import { track } from "@/lib/analytics";
import { SpeakButton, TopBar } from "@/components/ui";
import type { GuideMessage } from "@/lib/types";

const CHAT_KEY = "payana_chat_v1";
const MAX_REC_SECONDS = 20;

export default function GuidePage() {
  const { t, lang, crowd, toast } = useApp();
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [voiceHero, setVoiceHero] = useState(false);
  const recRef = useRef<VoiceRecorder | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setSiteId(q.get("site"));
    setVoiceHero(q.get("voice") === "1");
    try {
      const saved = sessionStorage.getItem(CHAT_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
    const pre = q.get("q");
    if (pre) setInput(pre);
  }, []);

  useEffect(() => {
    if (!messages.length) return; // cleared explicitly via the reset button
    try {
      sessionStorage.setItem(
        CHAT_KEY,
        JSON.stringify(messages.slice(-20).map((m) => ({ ...m, image: m.image && m.image.length < 200_000 ? m.image : undefined }))),
      );
    } catch {}
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  // Recording timer + auto-stop
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - (recRef.current?.startedAt || Date.now())) / 1000);
      setRecSecs(s);
      if (s >= MAX_REC_SECONDS) stopRecording();
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  const history = useCallback(
    (extra: GuideMessage[] = []) => [...messages, ...extra].filter((m) => m.text).map((m) => ({ role: m.role, text: m.text })),
    [messages],
  );

  const deliver = (res: Awaited<ReturnType<typeof askGuide>>, autoSpeak: boolean) => {
    const msg: GuideMessage = {
      role: "assistant",
      text: res.answer,
      siteId: res.siteId,
      confidence: res.confidence,
      provider: res.provider,
    };
    setMessages((m) => [...m, msg]);
    if (res.siteId) setSiteId(res.siteId);
    if (autoSpeak) speak(`msg-${Date.now()}`, res.answer, lang);
  };

  async function sendText(text: string) {
    const q = text.trim();
    if (!q || sendingRef.current) return;
    sendingRef.current = true;
    setInput("");
    setVoiceHero(false);
    const user: GuideMessage = { role: "user", text: q };
    setMessages((m) => [...m, user]);
    setBusy(true);
    track("ask", { siteId, lang });
    const res = await askGuide({ mode: "chat", lang, messages: history([user]), siteId, crowd: crowdSnapshot(crowd) });
    deliver(res, false);
    setBusy(false);
    sendingRef.current = false;
  }

  async function startRecording() {
    setVoiceHero(false);
    try {
      const r = new VoiceRecorder();
      await r.start();
      recRef.current = r;
      setRecSecs(0);
      setRecording(true);
    } catch {
      toast(t("guide.micDenied"));
    }
  }

  async function stopRecording() {
    const r = recRef.current;
    if (!r) return;
    recRef.current = null;
    setRecording(false);
    setBusy(true);
    try {
      const audio = await r.stop();
      if (audio.seconds < 0.7) {
        setBusy(false);
        return;
      }
      const placeholder: GuideMessage = { role: "user", text: "", voice: true };
      setMessages((m) => [...m, placeholder]);
      track("voice", { siteId, lang });
      const res = await askGuide({
        mode: "voice",
        lang,
        messages: history(),
        audio: { data: audio.base64, mime: audio.mime },
        siteId,
        crowd: crowdSnapshot(crowd),
      });
      setMessages((m) => {
        const copy = [...m];
        const idx = copy.lastIndexOf(placeholder);
        if (idx >= 0) copy[idx] = { ...placeholder, text: res.transcript || "🎤" };
        return copy;
      });
      deliver(res, true);
    } catch {
      toast(t("scan.error"));
    }
    setBusy(false);
  }

  async function sendPhoto(file: File) {
    setVoiceHero(false);
    setBusy(true);
    try {
      const img = await compressImage(file);
      const user: GuideMessage = { role: "user", text: input.trim(), image: img.dataUrl };
      setInput("");
      setMessages((m) => [...m, user]);
      track("scan", { lang, meta: { via: "guide" } });
      const res = await askGuide({
        mode: "scan",
        lang,
        messages: history([user]),
        image: { data: img.base64, mime: img.mime },
        siteId,
        crowd: crowdSnapshot(crowd),
      });
      deliver(res, true);
    } catch {
      toast(t("scan.error"));
    }
    setBusy(false);
  }

  const focus = getSite(siteId);
  const suggestions = ["guide.s1", "guide.s2", "guide.s3", "guide.s4"].map((k) => t(k));

  return (
    <div className="flex min-h-dvh flex-col" style={{ paddingBottom: "calc(150px + env(safe-area-inset-bottom))" }}>
      <TopBar
        title={t("guide.title")}
        right={
          messages.length > 0 ? (
            <button
              onClick={() => {
                setMessages([]);
                try {
                  sessionStorage.removeItem(CHAT_KEY);
                } catch {}
              }}
              className="rounded-full px-2 py-1 text-[11px] text-muted hover:text-cream">
              ↺
            </button>
          ) : undefined
        }
      />

      {focus && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-gold/25 bg-maroon-800/60 p-2">
          <img src={sitePhoto(focus.id).src} alt="" className="h-9 w-9 rounded-lg object-cover" />
          <span className="flex-1 truncate text-xs text-sand">
            {t("guide.about")}: <b className="text-cream">{focus.name[lang]}</b>
          </span>
          <button onClick={() => setSiteId(null)} className="p-1 text-muted" aria-label={t("close")}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex-1 space-y-3 px-4 pt-4">
        {/* Welcome */}
        <div className="flex gap-2">
          <img src="/icons/icon-192.png" alt="" className="mt-1 h-8 w-8 shrink-0 rounded-full" />
          <div className="card max-w-[85%] rounded-tl-sm px-4 py-3 text-sm leading-relaxed">{t("guide.welcome")}</div>
        </div>

        {voiceHero && messages.length === 0 && !recording && (
          <div className="fade-up flex flex-col items-center py-6 text-center">
            <button
              onClick={startRecording}
              className="pulse-ring flex h-28 w-28 items-center justify-center rounded-full text-maroon-950 shadow-2xl"
              style={{ background: "linear-gradient(180deg,#ffffff,#f1e7d8)" }}
              aria-label={t("guide.tapToSpeak")}
            >
              <Mic size={46} strokeWidth={2.2} />
            </button>
            <p className="mt-4 text-sm font-semibold text-gold-light">{t("guide.tapToSpeak")}</p>
            <p className="mt-1 text-xs text-muted">ಕನ್ನಡ · हिंदी · English</p>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="fade-up flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gold/90 px-4 py-2.5 text-sm text-maroon-950">
                {m.image && <img src={m.image} alt="" className="mb-2 max-h-48 w-full rounded-xl object-cover" />}
                {m.voice && <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider opacity-70">🎤 {t("guide.youSaid")}</span>}
                {m.text || (m.voice ? <Loader2 size={14} className="animate-spin" /> : null)}
              </div>
            </div>
          ) : (
            <div key={i} className="fade-up flex gap-2">
              <img src="/icons/icon-192.png" alt="" className="mt-1 h-8 w-8 shrink-0 rounded-full" />
              <div className="card max-w-[85%] rounded-tl-sm px-4 py-3">
                <p className="whitespace-pre-line text-sm leading-relaxed">{m.text}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <SpeakButton id={`m${i}`} text={m.text} />
                  {m.siteId && (
                    <Link href={`/site/${m.siteId}`} className="rounded-full border border-teal/50 px-3 py-1.5 text-xs font-semibold text-teal">
                      {getSite(m.siteId)?.name[lang]} →
                    </Link>
                  )}
                </div>
                <p className="mt-2 flex items-center gap-1 text-[10px] text-muted">
                  {m.provider === "offline" ? (
                    <>
                      <WifiOff size={11} /> {t("guide.offline")}
                    </>
                  ) : (
                    <>
                      <BadgeCheck size={11} className="text-teal" /> {t("guide.grounded")}
                    </>
                  )}
                </p>
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex gap-2">
            <img src="/icons/icon-192.png" alt="" className="mt-1 h-8 w-8 shrink-0 rounded-full" />
            <div className="card flex items-center gap-2 px-4 py-3 text-sm text-sand">
              <Loader2 size={16} className="animate-spin text-gold" /> {t("guide.thinking")}
            </div>
          </div>
        )}

        {messages.length === 0 && !busy && (
          <div className="flex flex-wrap gap-2 pt-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => sendText(s)} className="chip text-left">
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-md px-3"
        style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
      >
        {recording ? (
          <div className="card flex items-center gap-3 border-packed/60 p-2 pl-4">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-packed" />
            <span className="flex-1 text-sm text-cream">
              {t("guide.listening")} <b className="text-gold">{recSecs}s</b>
            </span>
            <button onClick={stopRecording} className="rec-ring flex h-12 w-12 items-center justify-center rounded-full bg-packed text-white" aria-label={t("stop")}>
              <Square size={18} fill="currentColor" />
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendText(input);
            }}
            className="card flex items-center gap-1.5 p-1.5"
          >
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-full text-gold-light hover:bg-maroon-700" aria-label={t("scan.upload")}>
              <ImagePlus size={20} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("guide.placeholder")}
              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-cream outline-none placeholder:text-muted/70"
              disabled={busy}
            />
            {input.trim() ? (
              <button type="submit" disabled={busy} className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-maroon-950" aria-label="Send">
                <Send size={18} />
              </button>
            ) : (
              <button type="button" onClick={startRecording} disabled={busy} className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-maroon-950" aria-label={t("tile.ask")}>
                <Mic size={19} />
              </button>
            )}
          </form>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) sendPhoto(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
