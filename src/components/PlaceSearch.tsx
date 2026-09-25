"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { currentPosition, searchKarnataka, type FoundPlace } from "@/lib/location";
import { QUICK_STARTS, type StartPoint } from "@/lib/planner";

/** Pick a starting point anywhere in Karnataka: search, GPS, or a quick pick. */
export default function PlaceSearch({ value, onChange }: { value: StartPoint; onChange: (p: StartPoint) => void }) {
  const { t } = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoundPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState("");
  const reqId = useRef(0);

  // Debounced search as the user types.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      const found = await searchKarnataka(query);
      if (id !== reqId.current) return;
      setResults(found);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [q]);

  const choose = (p: StartPoint) => {
    onChange(p);
    setQ("");
    setResults([]);
    setErr("");
  };

  const useGps = async () => {
    setErr("");
    setLocating(true);
    try {
      const pos = await currentPosition();
      choose({ label: t("trip.myLocation"), lat: pos.lat, lng: pos.lng });
    } catch {
      setErr(t("trip.gpsFail"));
    }
    setLocating(false);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-xl border border-gold/40 bg-white/[0.05] px-3.5 py-3">
        <MapPin size={17} className="shrink-0 text-gold" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{value.label}</span>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input px-10"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("trip.search")}
          enterKeyHint="search"
          autoComplete="off"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted" aria-label={t("close")}>
            <X size={15} />
          </button>
        )}
      </div>

      {(searching || results.length > 0 || (q.trim().length >= 2 && !searching)) && (
        <div className="card overflow-hidden">
          {searching ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-sand">
              <Loader2 size={15} className="animate-spin" /> {t("trip.searching")}
            </p>
          ) : results.length ? (
            <ul className="divide-y divide-white/5">
              {results.map((r) => (
                <li key={`${r.label}-${r.lat}`}>
                  <button onClick={() => choose({ label: r.label, lat: r.lat, lng: r.lng })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5">
                    <MapPin size={15} className="shrink-0 text-gold" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{r.label}</span>
                      <span className="block truncate text-[11px] text-muted">{r.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted">{t("trip.noPlaces")}</p>
          )}
        </div>
      )}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={useGps} disabled={locating} className="chip shrink-0 border-teal/50 text-teal">
          {locating ? <Loader2 size={12} className="animate-spin" /> : <LocateFixed size={12} />} {t("trip.myLocation")}
        </button>
        {QUICK_STARTS.map((s) => (
          <button key={s.label} onClick={() => choose(s)} className={`chip shrink-0 ${value.label === s.label ? "chip-on" : ""}`}>
            {s.label}
          </button>
        ))}
      </div>
      {err && <p className="text-xs text-packed">{err}</p>}
    </div>
  );
}
