import { sbInsert } from "./supabase";
import type { Lang } from "./types";

export type EventType =
  | "open"
  | "scan"
  | "ask"
  | "voice"
  | "plan"
  | "reroute"
  | "navigate"
  | "artisan_contact"
  | "stamp"
  | "crowd_report"
  | "register"
  | "demo"
  | "sos";

const LOCAL_KEY = "payana_local_events";
const SID_KEY = "payana_sid";

/**
 * Random id for this app session (tab), so the dashboard can count distinct visitors
 * and not double-count someone who rebuilds a plan. Not tied to the account or device;
 * it disappears when the tab is closed.
 */
function sessionId() {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return null;
  }
}

/** Short random id to link a plan with its reroutes and navigation. */
export function newPlanId() {
  return Math.random().toString(36).slice(2, 10);
}

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
    { type, site_id: opts.siteId ?? null, lang: opts.lang ?? null, meta: { ...(opts.meta ?? {}), sid: sessionId() } },
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
