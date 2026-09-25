"use client";

import { useSyncExternalStore } from "react";
import { speechLang } from "./i18n";
import type { Lang } from "./types";

/**
 * Speaks answers aloud. Uses the phone's built-in voice when it has one for the
 * language (free, instant, offline); otherwise Gemini TTS via /api/tts.
 * Speech is queued sentence by sentence so pause/resume works on every phone
 * (speechSynthesis.pause() is unreliable on Android).
 */

export interface NowPlaying {
  id: string;
  title?: string;
  href?: string;
  status: "loading" | "playing" | "paused";
}

let np: NowPlaying | null = null;
const listeners = new Set<() => void>();
let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;

let mode: "device" | "cloud" = "device";
let queue: string[] = [];
let qIndex = 0;
let qVoice: SpeechSynthesisVoice | null = null;
let qRate = 1;
let playToken = 0; // invalidates callbacks from an earlier/paused playback

function set(next: NowPlaying | null) {
  np = next;
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useNowPlaying() {
  return useSyncExternalStore(subscribe, () => np, () => null);
}

/** Id of the item currently loading/playing/paused (for Listen buttons). */
export function useSpeaking() {
  return useNowPlaying()?.id ?? null;
}

const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

/** Call once from a user gesture so later async playback is allowed (iOS/Android). */
export function unlockAudio() {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;
  try {
    sharedAudio = new Audio();
    sharedAudio.src = SILENT;
    sharedAudio.play().catch(() => {});
  } catch {}
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis?.speak(u);
  } catch {}
}

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((res) => {
    const synth = window.speechSynthesis;
    if (!synth) return res([]);
    const v = synth.getVoices();
    if (v.length) return res(v);
    const timer = setTimeout(() => res(synth.getVoices()), 1200);
    synth.onvoiceschanged = () => {
      clearTimeout(timer);
      res(synth.getVoices());
    };
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], code: string) {
  const norm = (s: string) => s.replace("_", "-").toLowerCase();
  const exact = voices.filter((v) => norm(v.lang) === code.toLowerCase());
  const prefix = voices.filter((v) => norm(v.lang).startsWith(code.slice(0, 2).toLowerCase()));
  const pool = exact.length ? exact : prefix;
  return pool.find((v) => /google|natural|neural/i.test(v.name)) || pool[0];
}

function clean(text: string) {
  return text
    .replace(/[*_#`>]+/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function chunks(text: string) {
  const parts = text.split(/(?<=[.!?।॥])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    if ((buf + " " + p).length > 220 && buf) {
      out.push(buf);
      buf = p;
    } else buf = buf ? `${buf} ${p}` : p;
  }
  if (buf) out.push(buf);
  return out;
}

function speakChunk(token: number) {
  if (token !== playToken || np?.status !== "playing") return;
  if (qIndex >= queue.length) return set(null);
  const u = new SpeechSynthesisUtterance(queue[qIndex]);
  if (qVoice) {
    u.voice = qVoice;
    u.lang = qVoice.lang;
  }
  u.rate = qRate;
  u.onend = () => {
    if (token !== playToken || np?.status !== "playing") return;
    qIndex++;
    speakChunk(token);
  };
  u.onerror = (e) => {
    if (token !== playToken || e.error === "interrupted" || e.error === "canceled") return;
    qIndex++;
    speakChunk(token);
  };
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  playToken++;
  try {
    window.speechSynthesis?.cancel();
  } catch {}
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.onended = null;
  }
  set(null);
}

export function pauseSpeaking() {
  if (!np || np.status !== "playing") return;
  if (mode === "device") {
    playToken++; // current sentence is replayed from its start on resume
    try {
      window.speechSynthesis.cancel();
    } catch {}
  } else {
    sharedAudio?.pause();
  }
  set({ ...np, status: "paused" });
}

export function resumeSpeaking() {
  if (!np || np.status !== "paused") return;
  set({ ...np, status: "playing" });
  if (mode === "device") {
    speakChunk(++playToken);
  } else {
    sharedAudio?.play().catch(() => set(null));
  }
}

async function speakCloud(token: number, text: string, lang: Lang) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 1400), lang }),
  });
  if (!res.ok) throw new Error("tts unavailable");
  const blob = await res.blob();
  if (token !== playToken) return;
  const a = sharedAudio ?? new Audio();
  sharedAudio = a;
  a.src = URL.createObjectURL(blob);
  a.onended = () => token === playToken && set(null);
  await a.play();
  if (token === playToken && np) set({ ...np, status: "playing" });
}

export async function speak(
  id: string,
  text: string,
  lang: Lang,
  meta: { title?: string; href?: string } = {},
): Promise<"device" | "cloud" | "none"> {
  stopSpeaking();
  const token = ++playToken;
  set({ id, title: meta.title, href: meta.href, status: "loading" });
  const body = clean(text);
  const voice = pickVoice(await getVoices(), speechLang(lang));
  if (token !== playToken) return "none";

  if (voice) {
    mode = "device";
    queue = chunks(body);
    qIndex = 0;
    qVoice = voice;
    qRate = lang === "en" ? 1 : 0.95;
    set({ id, title: meta.title, href: meta.href, status: "playing" });
    speakChunk(token);
    return "device";
  }
  try {
    mode = "cloud";
    await speakCloud(token, body, lang);
    return "cloud";
  } catch {
    if (token === playToken) set(null);
    return "none";
  }
}
