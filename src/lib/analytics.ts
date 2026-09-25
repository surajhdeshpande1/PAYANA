import { sbInsert } from "./supabase";
import type { Lang } from "./types";

export type EventType =
  | "open"
  | "scan"
  | "ask"
  | "voice"
  | "plan"
  | "reroute"
  | "artisan_contact"
  | "stamp"
  | "crowd_report"
  | "register"
  | "demo"
  | "sos";

const LOCAL_KEY = "payana_local_events";

/** Anonymous, privacy-safe usage events: no names, no location, no device IDs. */
export function track(
  type: EventType,
  opts: { siteId?: string | null; lang?: Lang; meta?: Record<string, unknown> } = {},
) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const counts: Record<string, number> = raw ? JSON.parse(raw) : {};
    counts[type] = (counts[type] || 0) + 1;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(counts));
  } catch {}
  sbInsert(
    "events",
    { type, site_id: opts.siteId ?? null, lang: opts.lang ?? null, meta: opts.meta ?? {} },
    true,
  ).catch(() => {});
}

export function localEventCounts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
  } catch {
    return {};
  }
}
