"use client";

import { useRouter } from "next/navigation";
import { Loader2, Pause, Play, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { pauseSpeaking, resumeSpeaking, stopSpeaking, useNowPlaying } from "@/lib/tts";

/**
 * Floating voice player shown whenever something is being read aloud.
 * Tap the player to open the place being described; pause/resume and stop stay one tap away.
 */
export default function MiniPlayer() {
  const np = useNowPlaying();
  const router = useRouter();
  const { t } = useApp();
  if (!np) return null;

  const playing = np.status === "playing";
  const loading = np.status === "loading";
  const open = () => {
    if (np.href) router.push(np.href);
  };

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 z-[66] mx-auto max-w-md px-3" style={{ top: "calc(10px + env(safe-area-inset-top))" }}>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => e.key === "Enter" && open()}
        aria-label={np.title ? `${t("player.nowPlaying")}: ${np.title}` : t("player.nowPlaying")}
        className="fade-up pointer-events-auto flex cursor-pointer items-center gap-3 rounded-full border border-white/15 bg-maroon-900/95 py-2 pl-3 pr-2 shadow-[0_14px_34px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold">
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : playing ? (
            <span className="eq" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          ) : (
            <Pause size={15} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
            {loading ? t("player.loading") : playing ? t("player.nowPlaying") : t("player.paused")}
          </span>
          <span className="block truncate text-sm font-semibold text-white">{np.title || t("guide.title")}</span>
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (playing) pauseSpeaking();
            else resumeSpeaking();
          }}
          disabled={loading}
          aria-label={playing ? t("player.pause") : t("player.resume")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-maroon-950 disabled:opacity-50"
        >
          {playing || loading ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            stopSpeaking();
          }}
          aria-label={t("player.stop")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-white"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
