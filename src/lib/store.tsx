"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { crowdAt, nextSundayNoon, type CrowdLevel } from "./crowd";
import { translate } from "./i18n";
import { sbInsert, sbRpc, sbSelect } from "./supabase";
import { track } from "./analytics";
import { useAuth } from "./auth";
import type { CrowdReport, Lang, Site } from "./types";

type TimeMode = "live" | "sunday";

/** Device-wide preferences. */
interface Persisted {
  lang: Lang;
  langChosen: boolean;
  a11y: boolean;
}

/** Heritage Passport — belongs to the signed-in account (synced to Supabase). */
interface Passport {
  stamps: Record<string, number>;
  artisanContacted: boolean;
  crowdReported: boolean;
}

interface Toast {
  id: number;
  text: string;
}

interface AppState extends Persisted, Passport {
  ready: boolean;
  setLang: (l: Lang) => void;
  setA11y: (v: boolean) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  timeMode: TimeMode;
  setTimeMode: (m: TimeMode) => void;
  now: Date;
  isLive: boolean;
  reports: CrowdReport[];
  reportCrowd: (siteId: string, level: number) => void;
  crowd: (site: Site, at?: Date) => { pct: number; level: CrowdLevel; reports: number };
  stamp: (siteId: string) => boolean;
  markArtisanContacted: () => void;
  resetPassport: () => Promise<void>;
  online: boolean;
  toast: (text: string) => void;
  toasts: Toast[];
  demoStep: number | null;
  setDemoStep: (s: number | null) => void;
}

const DEFAULTS: Persisted = { lang: "en", langChosen: false, a11y: false };
const EMPTY_PASSPORT: Passport = { stamps: {}, artisanContacted: false, crowdReported: false };

const KEY = "payana_state_v1";
const PASSPORT_KEY = (email: string) => `payana_passport_v1:${email.toLowerCase()}`;
const PENDING_KEY = "payana_pending_reports";

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [p, setP] = useState<Persisted>(DEFAULTS);
  // The passport is tagged with the account it belongs to, so switching accounts never mixes stamps.
  const [pp, setPP] = useState<{ owner: string | null; data: Passport }>({ owner: null, data: EMPTY_PASSPORT });
  const passport = pp.data;
  const setPassport = useCallback((fn: (d: Passport) => Passport) => setPP((cur) => ({ ...cur, data: fn(cur.data) })), []);
  const [ready, setReady] = useState(false);
  const [timeMode, setTimeMode] = useState<TimeMode>("live");
  const [realNow, setRealNow] = useState(() => new Date());
  const [reports, setReports] = useState<CrowdReport[]>([]);
  const [online, setOnline] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [demoStep, setDemoStepState] = useState<number | null>(null);
  const toastId = useRef(0);
  const email = user?.email ?? null;

  // Load persisted preferences after mount (avoids hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setP({ lang: saved.lang ?? DEFAULTS.lang, langChosen: Boolean(saved.langChosen), a11y: Boolean(saved.a11y) });
      }
      const d = sessionStorage.getItem("payana_demo");
      if (d) setDemoStepState(Number(d));
      const tm = sessionStorage.getItem("payana_time");
      if (tm === "sunday") setTimeMode("sunday");
    } catch {}
    setReady(true);
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(p)); // passport is no longer stored device-wide
    } catch {}
    document.documentElement.lang = p.lang;
    document.documentElement.classList.toggle("a11y", p.a11y);
  }, [p, ready]);

  // Each account gets its own passport: show this account's cached copy at once,
  // then replace it with the copy saved in the database. New accounts start empty.
  useEffect(() => {
    if (!email || !token) {
      setPP({ owner: null, data: EMPTY_PASSPORT });
      return;
    }
    let cachedData = EMPTY_PASSPORT;
    try {
      const cached = localStorage.getItem(PASSPORT_KEY(email));
      if (cached) cachedData = { ...EMPTY_PASSPORT, ...JSON.parse(cached) };
    } catch {}
    setPP({ owner: email, data: cachedData });
    let cancelled = false;
    sbRpc<{ stamps: Record<string, number>; artisan: boolean; crowd: boolean }>("app_passport_get", { p_token: token })
      .then((r) => {
        if (cancelled || !r) return;
        const data = { stamps: r.stamps || {}, artisanContacted: Boolean(r.artisan), crowdReported: Boolean(r.crowd) };
        setPP((cur) => (cur.owner === email ? { owner: email, data } : cur));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [email, token]);

  useEffect(() => {
    if (!email || pp.owner !== email) return; // only save a passport under its own account
    try {
      localStorage.setItem(PASSPORT_KEY(email), JSON.stringify(pp.data));
    } catch {}
  }, [pp, email]);

  useEffect(() => {
    try {
      sessionStorage.setItem("payana_time", timeMode);
    } catch {}
  }, [timeMode]);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setRealNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Session "open" event
  useEffect(() => {
    if (!ready) return;
    try {
      if (!sessionStorage.getItem("payana_opened")) {
        sessionStorage.setItem("payana_opened", "1");
        track("open", { lang: p.lang });
      }
    } catch {}
  }, [ready, p.lang]);

  // Live crowd reports (last 2h) from Supabase + this device's unsent reports.
  const loadReports = useCallback(async () => {
    let pending: CrowdReport[] = [];
    try {
      pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    } catch {}
    try {
      const since = new Date(Date.now() - 2 * 3600_000).toISOString();
      const rows = await sbSelect<CrowdReport>(
        "crowd_reports",
        `select=site_id,level,created_at&created_at=gte.${since}&order=created_at.desc&limit=300`,
      );
      // Retry pending uploads now that we're connected.
      if (pending.length) {
        const still: CrowdReport[] = [];
        for (const r of pending) {
          try {
            await sbInsert("crowd_reports", { site_id: r.site_id, level: r.level });
          } catch {
            still.push(r);
          }
        }
        localStorage.setItem(PENDING_KEY, JSON.stringify(still));
      }
      setReports([...rows, ...pending]);
    } catch {
      setReports(pending);
    }
  }, []);

  useEffect(() => {
    loadReports();
    const id = setInterval(loadReports, 60_000);
    return () => clearInterval(id);
  }, [loadReports]);

  const now = useMemo(
    () => (timeMode === "sunday" ? nextSundayNoon(realNow) : realNow),
    [timeMode, realNow],
  );
  const isLive = timeMode === "live";

  const toast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts, { id, text }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3800);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(p.lang, key, vars),
    [p.lang],
  );

  const flag = useCallback(
    (f: "artisan" | "crowd") => {
      if (token) sbRpc("app_passport_flag", { p_token: token, p_flag: f }).catch(() => {});
    },
    [token],
  );

  const reportCrowd = useCallback(
    (siteId: string, level: number) => {
      const r: CrowdReport = { site_id: siteId, level, created_at: new Date().toISOString() };
      setReports((rs) => [r, ...rs]);
      setPassport((s) => ({ ...s, crowdReported: true }));
      flag("crowd");
      track("crowd_report", { siteId, lang: p.lang, meta: { level } });
      sbInsert("crowd_reports", { site_id: siteId, level }).catch(() => {
        try {
          const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
          pending.push(r);
          localStorage.setItem(PENDING_KEY, JSON.stringify(pending.slice(-50)));
        } catch {}
      });
    },
    [p.lang, flag, setPassport],
  );

  const crowd = useCallback(
    (site: Site, at?: Date) => crowdAt(site, at ?? now, reports, isLive && !at),
    [now, reports, isLive],
  );

  const stamp = useCallback(
    (siteId: string) => {
      if (passport.stamps[siteId]) return false;
      setPassport((s) => (s.stamps[siteId] ? s : { ...s, stamps: { ...s.stamps, [siteId]: Date.now() } }));
      track("stamp", { siteId, lang: p.lang });
      if (token) sbRpc("app_passport_stamp", { p_token: token, p_site: siteId }).catch(() => {});
      return true;
    },
    [p.lang, passport.stamps, token, setPassport],
  );

  const markArtisanContacted = useCallback(() => {
    setPassport((s) => (s.artisanContacted ? s : { ...s, artisanContacted: true }));
    if (!passport.artisanContacted) flag("artisan");
  }, [passport.artisanContacted, flag, setPassport]);

  const resetPassport = useCallback(async () => {
    setPassport(() => EMPTY_PASSPORT);
    if (token) await sbRpc("app_passport_reset", { p_token: token }).catch(() => {});
  }, [token]);

  const setDemoStep = useCallback((s: number | null) => {
    setDemoStepState(s);
    try {
      if (s === null) sessionStorage.removeItem("payana_demo");
      else sessionStorage.setItem("payana_demo", String(s));
    } catch {}
  }, []);

  const value: AppState = {
    ...p,
    ...passport,
    ready,
    setLang: (l) => setP((s) => ({ ...s, lang: l, langChosen: true })),
    setA11y: (v) => setP((s) => ({ ...s, a11y: v })),
    t,
    timeMode,
    setTimeMode,
    now,
    isLive,
    reports,
    reportCrowd,
    crowd,
    stamp,
    markArtisanContacted,
    resetPassport,
    online,
    toast,
    toasts,
    demoStep,
    setDemoStep,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
