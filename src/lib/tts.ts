"use client";

import { useSyncExternalStore } from "react";
import { speechLang } from "./i18n";
import type { Lang } from "./types";

/**
 * Reads answers aloud.
 *
 * Natural voice (default): Gemini TTS via /api/tts. The text is split into
 * growing chunks (a short first sentence so audio starts quickly, then longer
 * pieces) that are fetched ahead while the current one plays, so the narration
 * flows without waiting for the whole answer.
 *
 * Device voice (fallback, or when the natural voice is switched off / offline /
 * rate-limited): the phone's built-in voice, with every sentence queued up front
 * so there are no gaps between them. Pause/resume works on both paths.
 */

export interface NowPlaying {
  id: string;
  title?: string;
  href?: string;
  status: "loading" | "playing" | "paused";
}

export interface VoiceSettings {
  speed: number;
  natural: boolean;
}

export const SPEEDS = [1, 1.15, 1.3, 1.5];
const SETTINGS_KEY = "payana_voice_v1";

let np: NowPlaying | null = null;
let settings: VoiceSettings = { speed: 1.15, natural: true };
let settingsLoaded = false;
const listeners = new Set<() => void>();
let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;
let playToken = 0; // bumps on every new playback/stop so stale callbacks do nothing

let mode: "device" | "cloud" = "device";
let playLang: Lang = "en";

// device queue
let queue: string[] = [];
let qIndex = 0;
let qVoice: SpeechSynthesisVoice | null = null;
let liveUtterances: SpeechSynthesisUtterance[] = []; // keep refs: Chrome drops callbacks of GC'd utterances

// cloud queue
interface CloudChunk {
  text: string;
  url?: Promise<string>;
}
let cloud: CloudChunk[] = [];
let cIndex = 0;
let cLoaded = -1; // index whose audio is currently in sharedAudio
let cloudDownUntil = 0;
const audioCache = new Map<string, string>(); // `${lang}|${text}` → object URL

/** Tell the app (AppShell shows a toast) that nothing could read this text aloud. */
function noVoice(lang: Lang) {
  set(null);
  try {
    window.dispatchEvent(new CustomEvent("payana:novoice", { detail: lang }));
  } catch {}
}

function emit() {
  listeners.forEach((l) => l());
}

function set(next: NowPlaying | null) {
  np = next;
  emit();
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

/* ---------------- Settings (speed, natural voice) ---------------- */

function loadSettings() {
  if (settingsLoaded || typeof window === "undefined") return;
  settingsLoaded = true;
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (s && typeof s === "object") {
      if (SPEEDS.includes(s.speed)) settings = { ...settings, speed: s.speed };
      if (typeof s.natural === "boolean") settings = { ...settings, natural: s.natural };
    }
  } catch {}
}

function saveSettings(next: VoiceSettings) {
  settings = next;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {}
  emit();
}

const SERVER_SETTINGS: VoiceSettings = { speed: 1.15, natural: true };

export function useVoiceSettings() {
  return useSyncExternalStore(
    subscribe,
    () => {
      loadSettings();
      return settings;
    },
    () => SERVER_SETTINGS,
  );
}

/** Cycle 1× → 1.15× → 1.3× → 1.5× and apply it to whatever is playing now. */
export function cycleSpeed() {
  loadSettings();
  const i = SPEEDS.indexOf(settings.speed);
  saveSettings({ ...settings, speed: SPEEDS[(i + 1) % SPEEDS.length] });
  if (!np) return;
  if (mode === "cloud") {
    if (sharedAudio) sharedAudio.playbackRate = settings.speed;
  } else if (np.status === "playing") {
    // Device voices take the rate per sentence: restart the current one at the new speed.
    const token = ++playToken;
    try {
      window.speechSynthesis.cancel();
    } catch {}
    setTimeout(() => enqueueDevice(token), 60);
  }
}

export function setNaturalVoice(on: boolean) {
  loadSettings();
  saveSettings({ ...settings, natural: on });
}

/* ---------------- Helpers ---------------- */

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

/** Language of the text by its script, so a Kannada answer is read by a Kannada voice. */
export function detectLang(text: string, fallback: Lang): Lang {
  let kn = 0;
  let hi = 0;
  let latin = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x0c80 && c <= 0x0cff) kn++;
    else if (c >= 0x0900 && c <= 0x097f) hi++;
    else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) latin++;
  }
  const total = kn + hi + latin;
  if (!total) return fallback;
  if (kn / total > 0.3) return "kn";
  if (hi / total > 0.3) return "hi";
  if (latin / total > 0.7) return "en";
  return fallback;
}

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((res) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
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

const NOVELTY = /(bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|kathy|ralph|grandma|grandpa|rocko|shelley|flo|reed|sandy|eddy)/i;

/** Best-sounding installed voice for the language (natural/neural/enhanced voices first). */
function pickVoice(voices: SpeechSynthesisVoice[], code: string) {
  const norm = (s: string) => s.replace("_", "-").toLowerCase();
  const want = code.toLowerCase();
  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -1;
  for (const v of voices) {
    const vl = norm(v.lang);
    let s: number;
    if (vl === want) s = 50;
    else if (vl.startsWith(want.slice(0, 2))) s = 30;
    else continue;
    if (/natural|neural|online/i.test(v.name)) s += 25;
    if (/premium|enhanced/i.test(v.name)) s += 20;
    if (/google/i.test(v.name)) s += 15;
    if (NOVELTY.test(v.name)) s -= 40;
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}

/** Make text pleasant to listen to: no markdown, symbols read as words. */
function clean(text: string) {
  return text
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>|]+/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/₹\s?(\d[\d,]*)/g, "$1 rupees")
    .replace(/(\d)\s?km\b/g, "$1 kilometres")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*[•·]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string) {
  // Split long sentences at commas too, so no single piece is too long for a voice.
  const out: string[] = [];
  for (const s of text.split(/(?<=[.!?।॥])\s+/)) {
    if (s.length <= 200) {
      out.push(s);
      continue;
    }
    let buf = "";
    for (const part of s.split(/(?<=[,;:])\s+/)) {
      if (buf && (buf + " " + part).length > 200) {
        out.push(buf);
        buf = part;
      } else buf = buf ? `${buf} ${part}` : part;
    }
    if (buf) out.push(buf);
  }
  return out.filter((s) => s.trim());
}

/** Group sentences into pieces no longer than `max` characters. */
function group(parts: string[], max: number) {
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    if (buf && (buf + " " + p).length > max) {
      out.push(buf);
      buf = p;
    } else buf = buf ? `${buf} ${p}` : p;
  }
  if (buf) out.push(buf);
  return out;
}

/** Cloud chunks grow: quick first sentence, then longer pieces fetched in the background. */
function cloudChunks(text: string) {
  const parts = sentences(text);
  const out: string[] = [];
  const sizes = [130, 240, 420];
  let i = 0;
  while (i < parts.length) {
    const max = sizes[Math.min(out.length, sizes.length - 1)];
    let buf = parts[i++];
    while (i < parts.length && (buf + " " + parts[i]).length <= max) buf += " " + parts[i++];
    out.push(buf);
  }
  return out;
}

/* ---------------- Device voice ---------------- */

function enqueueDevice(token: number) {
  const synth = window.speechSynthesis;
  liveUtterances = [];
  for (let i = qIndex; i < queue.length; i++) {
    const u = new SpeechSynthesisUtterance(queue[i]);
    if (qVoice) {
      u.voice = qVoice;
      u.lang = qVoice.lang;
    }
    u.rate = settings.speed;
    u.onstart = () => {
      if (token === playToken) qIndex = i;
    };
    u.onend = () => {
      if (token !== playToken) return;
      qIndex = i + 1;
      if (i === queue.length - 1) set(null);
    };
    u.onerror = (e) => {
      if (token !== playToken || e.error === "interrupted" || e.error === "canceled") return;
      if (i === queue.length - 1) set(null);
    };
    liveUtterances.push(u);
    synth.speak(u);
  }
}

async function startDevice(token: number, text: string, lang: Lang, voice?: SpeechSynthesisVoice) {
  const v = voice ?? pickVoice(await getVoices(), speechLang(lang));
  if (token !== playToken) return true;
  if (!v) return false;
  mode = "device";
  queue = group(sentences(text), 220);
  qIndex = 0;
  qVoice = v;
  if (np) set({ ...np, status: "playing" });
  try {
    window.speechSynthesis.cancel();
  } catch {}
  setTimeout(() => token === playToken && enqueueDevice(token), 60);
  return true;
}

/* ---------------- Natural (cloud) voice ---------------- */

class TtsError extends Error {
  constructor(public status: number) {
    super(`tts ${status}`);
  }
}

function fetchAudio(text: string, lang: Lang): Promise<string> {
  const key = `${lang}|${text}`;
  const hit = audioCache.get(key);
  if (hit) return Promise.resolve(hit);
  return fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  }).then(async (res) => {
    if (!res.ok) throw new TtsError(res.status);
    const url = URL.createObjectURL(await res.blob());
    if (audioCache.size >= 40) {
      const [oldKey, oldUrl] = audioCache.entries().next().value!;
      audioCache.delete(oldKey);
      URL.revokeObjectURL(oldUrl);
    }
    audioCache.set(key, url);
    return url;
  });
}

function prefetch(from: number) {
  for (let i = from; i < Math.min(cloud.length, from + 3); i++) {
    const c = cloud[i];
    if (!c.url) {
      c.url = fetchAudio(c.text, playLang);
      c.url.catch(() => {}); // handled when that chunk's turn comes
    }
  }
}

function timeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new TtsError(408)), ms))]);
}

async function playCloud(token: number, i: number) {
  if (token !== playToken) return;
  if (i >= cloud.length) return set(null);
  cIndex = i;
  prefetch(i);
  let url: string;
  try {
    url = await timeout(cloud[i].url!, i === 0 ? 10000 : 30000);
  } catch (e) {
    if (token !== playToken) return;
    // Rate-limited or unavailable: remember for a while and continue on the device voice.
    if (e instanceof TtsError && [408, 429, 503].includes(e.status)) cloudDownUntil = Date.now() + 10 * 60_000;
    const rest = cloud
      .slice(i)
      .map((c) => c.text)
      .join(" ");
    if (!(await startDevice(token, rest, playLang))) noVoice(playLang);
    return;
  }
  if (token !== playToken) return;
  if (np?.status === "paused") return; // resumeSpeaking() picks up from cIndex
  const a = sharedAudio ?? new Audio();
  sharedAudio = a;
  a.onended = () => {
    if (token === playToken) playCloud(token, cIndex + 1);
  };
  a.src = url;
  cLoaded = i;
  a.playbackRate = settings.speed;
  try {
    await a.play();
    a.playbackRate = settings.speed; // some browsers reset it on load
    const cur = np as NowPlaying | null; // may have changed while play() was pending
    if (token === playToken && cur && cur.status !== "paused") set({ ...cur, status: "playing" });
  } catch {
    // Paused before playback began: resumeSpeaking() replays this piece.
    if (token !== playToken || (np as NowPlaying | null)?.status === "paused") return;
    const rest = cloud
      .slice(i)
      .map((c) => c.text)
      .join(" ");
    if (!(await startDevice(token, rest, playLang))) noVoice(playLang);
  }
}

/* ---------------- Public controls ---------------- */

export function stopSpeaking() {
  playToken++;
  try {
    window.speechSynthesis?.cancel();
  } catch {}
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.onended = null;
  }
  liveUtterances = [];
  set(null);
}

export function pauseSpeaking() {
  if (!np || np.status === "paused") return;
  if (mode === "device") {
    playToken++; // the current sentence is replayed from its start on resume
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
  if (mode === "device") {
    set({ ...np, status: "playing" });
    const token = ++playToken;
    setTimeout(() => token === playToken && enqueueDevice(token), 60);
    return;
  }
  const a = sharedAudio;
  if (a && cLoaded === cIndex && a.src && !a.ended) {
    set({ ...np, status: "playing" });
    a.playbackRate = settings.speed;
    a.play().catch(() => set(null));
  } else {
    // Paused while the next piece was still downloading.
    set({ ...np, status: "loading" });
    playCloud(playToken, cIndex);
  }
}

export async function speak(
  id: string,
  text: string,
  lang: Lang,
  meta: { title?: string; href?: string } = {},
): Promise<"device" | "cloud" | "none"> {
  stopSpeaking();
  loadSettings();
  const token = ++playToken;
  set({ id, title: meta.title, href: meta.href, status: "loading" });
  const body = clean(text);
  playLang = detectLang(body, lang);
  if (!body) {
    set(null);
    return "none";
  }

  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const voice = pickVoice(await getVoices(), speechLang(playLang));
  if (token !== playToken) return "none";
  const useCloud = online && Date.now() > cloudDownUntil && (settings.natural || !voice);

  if (useCloud) {
    mode = "cloud";
    cloud = cloudChunks(body).map((t) => ({ text: t }));
    cIndex = 0;
    cLoaded = -1;
    playCloud(token, 0);
    return "cloud";
  }
  if (await startDevice(token, body, playLang, voice)) return "device";
  if (token === playToken) noVoice(playLang);
  return "none";
}
