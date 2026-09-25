"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";
import { useApp } from "@/lib/store";
import { unlockAudio } from "@/lib/tts";
import BottomNav from "./BottomNav";
import FloatingMic from "./FloatingMic";
import LanguagePicker from "./LanguagePicker";
import DemoTour from "./DemoTour";
import MiniPlayer from "./MiniPlayer";
import Intro from "./Intro";
import AuthScreen from "./AuthScreen";
import { useAuth } from "@/lib/auth";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, langChosen, online, toasts, t, toast, demoStep } = useApp();
  const auth = useAuth();
  const path = usePathname();
  const bare = path?.startsWith("/share/print");

  // Opening film: once per app session (rendered on the server so it is the very first thing seen).
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    try {
      if (path?.startsWith("/share") || sessionStorage.getItem("payana_intro_done")) setIntro(false);
    } catch {
      setIntro(false);
    }
  }, [path]);
  const endIntro = useCallback(() => {
    try {
      sessionStorage.setItem("payana_intro_done", "1");
    } catch {}
    setIntro(false);
  }, []);
  const film = intro && !path?.startsWith("/share") ? <Intro onDone={endIntro} /> : null;

  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener("pointerdown", unlock, { once: true });
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const onNoVoice = () => toast(t("voice.none"));
    window.addEventListener("payana:novoice", onNoVoice);
    return () => window.removeEventListener("payana:novoice", onNoVoice);
  }, [toast, t]);

  if (bare) return <>{children}</>;

  // Accounts are required before the app (the QR share page stays open for judges).
  // New visitors go straight from the film to "Create account" (language can be switched there).
  const needsAuth = auth.ready && !auth.user && !path?.startsWith("/share");
  // The film stays at the same place in the tree whichever screen is under it, so it never restarts.
  if (ready && needsAuth) {
    return (
      <>
        <div className="relative mx-auto min-h-dvh w-full max-w-md">
          <AuthScreen />
        </div>
        {film}
      </>
    );
  }

  return (
    <>
      <div className="relative mx-auto min-h-dvh w-full max-w-md overflow-x-hidden sm:border-x sm:border-gold/10 sm:shadow-2xl">
        {!online && (
          <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-busy/95 px-3 py-1.5 text-xs font-semibold text-maroon-950">
            <WifiOff size={14} /> {t("offline")}
          </div>
        )}
        {children}
        {demoStep !== null && <div aria-hidden className="h-48" />}
        <FloatingMic />
        <BottomNav />
        <DemoTour />
        <MiniPlayer />
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] mx-auto flex max-w-md flex-col items-center gap-2 px-4">
          {toasts.map((x) => (
            <div key={x.id} className="fade-up card pointer-events-auto w-full px-4 py-3 text-sm text-cream shadow-xl">
              {x.text}
            </div>
          ))}
        </div>
        {ready && !langChosen && !needsAuth && <LanguagePicker />}
      </div>
      {film}
    </>
  );
}
