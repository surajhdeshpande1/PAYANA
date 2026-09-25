"use client";

import { useSyncExternalStore } from "react";
import { speechLang } from "./i18n";
import type { Lang } from "./types";

/**
 * Speaks answers aloud. Uses the phone's built-in voice when it has one for the
 * language (free, instant, offline). Falls back to Gemini TTS via /api/tts when the
 * device lacks e.g. a Kannada voice.
 */

let current: string | null = null;
const listeners = new Set<() => void>();
let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;

function emit(id: string | null) {
  current = id;
  listeners.forEach((l) => l());
}

export function useSpeaking() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

const SILENT =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

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

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {}
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.onended = null;
  }
  emit(null);
}

async function speakCloud(id: string, text: string, lang: Lang) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 1400), lang }),
  });
  if (!res.ok) throw new Error("tts unavailable");
  const blob = await res.blob();
  if (current !== id) return;
  const a = sharedAudio ?? new Audio();
  sharedAudio = a;
  a.src = URL.createObjectURL(blob);
  a.onended = () => current === id && emit(null);
  await a.play();
}

export async function speak(id: string, text: string, lang: Lang): Promise<"device" | "cloud" | "none"> {
  stopSpeaking();
  emit(id);
  const body = clean(text);
  const code = speechLang(lang);
  const voices = await getVoices();
  const voice = pickVoice(voices, code);

  if (voice) {
    const synth = window.speechSynthesis;
    const parts = chunks(body);
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = lang === "en" ? 1 : 0.95;
      if (i === parts.length - 1) u.onend = () => current === id && emit(null);
      u.onerror = () => current === id && i === parts.length - 1 && emit(null);
      synth.speak(u);
    });
    return "device";
  }
  try {
    await speakCloud(id, body, lang);
    return "cloud";
  } catch {
    emit(null);
    return "none";
  }
}
