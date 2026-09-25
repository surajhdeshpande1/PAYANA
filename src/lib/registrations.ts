import { sbInsert } from "./supabase";

export const PENDING_REG_KEY = "payana_pending_reg";

/** Retry registrations that were saved while offline. */
export async function flushPendingRegistrations() {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_REG_KEY) || "[]");
    if (!pending.length) return;
    const still = [];
    for (const r of pending) {
      try {
        await sbInsert("artisans", r);
      } catch {
        still.push(r);
      }
    }
    localStorage.setItem(PENDING_REG_KEY, JSON.stringify(still));
  } catch {}
}
