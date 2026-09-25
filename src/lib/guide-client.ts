"use client";

import { offlineAnswer, type CrowdSnapshot } from "./offline";
import { SITES } from "./sites";
import { cachedRemoved } from "./registrations";
import type { GuideRequest } from "./server/ai";
import type { GuideResponse, Site } from "./types";

export function crowdSnapshot(crowd: (s: Site) => { pct: number; level: string }): CrowdSnapshot {
  const out: CrowdSnapshot = {};
  for (const s of SITES) {
    const c = crowd(s);
    out[s.id] = { pct: c.pct, level: c.level };
  }
  return out;
}

export async function askGuide(req: GuideRequest): Promise<GuideResponse> {
  const lastUser = req.messages.filter((m) => m.role === "user").at(-1)?.text || "";
  const fallback = () =>
    offlineAnswer(lastUser, req.lang, { siteId: req.siteId, crowd: req.crowd, image: Boolean(req.image), audio: Boolean(req.audio), hidden: cachedRemoved() });
  if (typeof navigator !== "undefined" && !navigator.onLine) return fallback();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch("/api/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, localTime: new Date().toString() }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as GuideResponse;
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
