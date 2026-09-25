"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, Star, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { currentPosition, searchKarnataka, type FoundPlace } from "@/lib/location";
import { QUICK_STARTS, type StartPoint } from "@/lib/planner";

/**
 * One "Starting from" field: it shows the chosen place, and you tap it and type to change it.
 * Suggestions (your location, popular cities, search results anywhere in Karnataka) open
 * right under the field.
 */
export default function PlaceSearch({ value, onChange }: { value: StartPoint; onChange: (p: StartPoint) => void }) {
  const { t } = useApp();
  const [text, setText] = useState(value.label);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<FoundPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);
  const labelRef = useRef(value.label);
  labelRef.current = value.label;
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Show the chosen place in the field whenever it changes from outside (or after choosing).
  useEffect(() => {
    if (!open) setText(value.label);
  }, [value.label, open]);

  const query = open && text.trim() !== value.label ? text.trim() : "";

  // Debounced search as the user types.
  useEffect(() => {
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
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const close = () => {
    clearTimeout(blurTimer.current);
    setOpen(false);
    setResults([]);
    inputRef.current?.blur();
  };

  const choose = (p: StartPoint) => {
    onChange(p);
    setText(p.label);
    setErr("");
    close();
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

  const popular = QUICK_STARTS.filter((s) => !query || s.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 rounded-xl border bg-white/[0.05] px-3.5 transition ${open ? "border-gold" : "border-gold/40"}`}>
        <MapPin size={17} className="shrink-0 text-gold" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={(e) => {
            clearTimeout(blurTimer.current);
            setOpen(true);
            e.currentTarget.select(); // typing replaces the current place
          }}
          onBlur={() => {
            // Short delay so a tap on a suggestion still lands (iOS blurs before the click).
            blurTimer.current = setTimeout(() => {
              setOpen(false);
              setText(labelRef.current); // nothing picked: keep the current place
            }, 200);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "Enter") {
              e.preventDefault();
              const first = results[0];
              if (first) choose({ label: first.label, lat: first.lat, lng: first.lng });
              else if (popular[0] && query) choose(popular[0]);
            }
          }}
          placeholder={t("trip.search")}
          aria-label={t("trip.start")}
          enterKeyHint="search"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-white outline-none placeholder:font-normal placeholder:text-muted"
        />
        {open && text && (
          <button
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              setText("");
              inputRef.current?.focus();
            }}
            className="rounded-full p-1.5 text-muted"
            aria-label={t("close")}
          >
            <X size={15} />
          </button>
        )}
      </div>
      {!open && <p className="mt-1 text-[11px] text-muted">{t("trip.startHint")}</p>}

      {open && (
        // preventDefault keeps focus in the field so a tap on a suggestion isn't lost to blur
        <div onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} className="card-solid absolute inset-x-0 top-full z-30 mt-1.5 max-h-[60vh] overflow-y-auto shadow-2xl">
          <button onClick={useGps} disabled={locating} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-teal hover:bg-white/5">
            {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />} {t("trip.myLocation")}
          </button>

          {query.length >= 2 && (
            <div className="border-t border-white/5">
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

          {popular.length > 0 && (
            <div className="border-t border-white/5 pb-1">
              <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">{t("trip.popular")}</p>
              {popular.map((s) => (
                <button key={s.label} onClick={() => choose(s)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-sand hover:bg-white/5">
                  <Star size={13} className={value.label === s.label ? "fill-gold text-gold" : "text-muted"} /> {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {err && <p className="mt-1 text-xs text-packed">{err}</p>}
    </div>
  );
}
