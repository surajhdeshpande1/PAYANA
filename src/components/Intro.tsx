"use client";

import { useEffect } from "react";

/**
 * 7-second opening film, "From Ilkal's looms to Chalukya stone":
 *  0.0–2.0 s  gold warp threads and kumkum-red weft weave a Kasuti "gopura" motif
 *  1.8–3.8 s  the stitched tower becomes stone: Pattadakal's Dravida vimana, a Nagara
 *             shikhara and Aihole's apsidal Durga temple, with Badami's red cliffs behind
 *  2.2–5.0 s  dawn over Agastya lake: the sun rises, reflections ripple, lamps drift up
 *  4.1–6.2 s  Ilkal "tope teni" borders frame the ಪಯಣ wordmark
 *  6.3–7.0 s  the scene fades into the app
 */
export const INTRO_MS = 7000;

const DL = (s: number, d?: number) => ({ "--dl": `${s}s`, ...(d ? { "--d": `${d}s` } : {}) }) as React.CSSProperties;

// Kasuti gopura: a stepped tower of cross-stitches, sized to sit where the vimana is drawn.
const STITCHES = Array.from({ length: 6 }, (_, r) => {
  const count = 11 - r * 2;
  const y = 441 - r * 11;
  return Array.from({ length: count }, (_, i) => ({ x: 200 - (count * 9) / 2 + i * 9, y, r }));
}).flat();

// Deterministic "random" lamps so server and client render the same markup.
const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  x: 50 + ((i * 97) % 300),
  y: 548 + ((i * 53) % 60),
  r: 1 + ((i * 7) % 3) * 0.6,
  dl: 3.6 + ((i * 29) % 26) / 10,
  d: 2.2 + ((i * 13) % 9) / 10,
  rise: -(150 + ((i * 41) % 130)),
}));

const WARP = Array.from({ length: 14 }, (_, i) => 70 + i * 20);
const WEFT = [262, 276, 290, 600, 614, 628];

function Temples() {
  return (
    <g fill="url(#pi-stone)" stroke="#e9c987" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round">
      {/* plinth */}
      <path className="pi-draw" style={DL(1.7, 1)} pathLength={1} d="M24 540 H376 M40 528 H360 M40 528 L32 540 M360 528 L368 540" fill="none" />

      {/* Pattadakal — Dravida vimana (Virupaksha style) */}
      <path className="pi-draw pi-fill" style={DL(1.9, 1.6)} pathLength={1} d="M150 528 V452 H250 V528 Z" />
      <path className="pi-draw" style={DL(2.0, 1.4)} pathLength={1} fill="none" d="M165 528 V460 M235 528 V460 M190 528 V494 Q200 482 210 494 V528 M144 452 H256" />
      <path className="pi-draw pi-fill" style={DL(2.2, 1.3)} pathLength={1} d="M156 452 V430 H244 V452 Z M150 430 H250" />
      <path className="pi-draw pi-fill" style={DL(2.4, 1.2)} pathLength={1} d="M166 430 V410 H234 V430 Z M160 410 H240" />
      <path className="pi-draw pi-fill" style={DL(2.6, 1.1)} pathLength={1} d="M176 410 V392 H224 V410 Z M171 392 H229" />
      <path className="pi-draw pi-fill" style={DL(2.75, 1)} pathLength={1} d="M186 392 V380 H214 V392 Z" />
      <path className="pi-draw pi-fill" style={DL(2.9, 1)} pathLength={1} d="M180 380 C182 360 190 348 200 345 C210 348 218 360 220 380 Z" />
      <path className="pi-draw" style={DL(3.1, 0.8)} pathLength={1} fill="none" d="M200 345 V334 M195 334 H205 M200 334 C196 330 197 325 200 322 C203 325 204 330 200 334" />
      <path className="pi-draw" style={DL(2.5, 1)} pathLength={1} fill="none" d="M156 430 q6 -11 12 0 M232 430 q6 -11 12 0 M166 410 q5 -9 10 0 M224 410 q5 -9 10 0 M176 392 q4 -8 8 0 M216 392 q4 -8 8 0" />

      {/* Nagara shikhara (Galaganatha / Papanatha style) */}
      <path className="pi-draw pi-fill" style={DL(2.1, 1.3)} pathLength={1} d="M62 528 V470 H122 V528 Z M58 470 H126" />
      <path className="pi-draw pi-fill" style={DL(2.4, 1.3)} pathLength={1} d="M66 470 C68 432 80 404 92 396 C104 404 116 432 118 470 Z" />
      <path className="pi-draw" style={DL(2.8, 0.9)} pathLength={1} fill="none" d="M71 452 H113 M75 436 H109 M80 420 H104 M84 528 V502 H100 V528" />
      <path className="pi-draw pi-fill" style={DL(3.0, 0.8)} pathLength={1} d="M80 396 C80 389 104 389 104 396 C104 402 80 402 80 396 Z M92 390 V378" />

      {/* Aihole — apsidal Durga temple with its pillared veranda */}
      <path className="pi-draw pi-fill" style={DL(2.2, 1.4)} pathLength={1} d="M272 528 V482 H334 C346 482 354 492 354 504 V528 Z" />
      <path className="pi-draw" style={DL(2.5, 1.2)} pathLength={1} fill="none" d="M266 482 H336 C350 482 360 492 360 506 M282 528 V488 M294 528 V488 M306 528 V488 M318 528 V488 M330 528 V488" />
      <path className="pi-draw pi-fill" style={DL(2.7, 1.1)} pathLength={1} d="M298 482 C300 464 307 454 315 450 C323 454 330 464 332 482 Z" />
      <path className="pi-draw pi-fill" style={DL(3.0, 0.8)} pathLength={1} d="M304 450 C304 445 326 445 326 450 C326 454 304 454 304 450 Z M315 445 V436" />
    </g>
  );
}

export default function Intro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    // The film starts at first paint (it is server-rendered), so finish 7 s after that,
    // not 7 s after the app becomes interactive.
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? performance.now();
    const left = Math.max(400, INTRO_MS - (performance.now() - fcp));
    const id = setTimeout(onDone, left);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="pi-root fixed inset-0 z-[100] overflow-hidden bg-maroon-950" role="dialog" aria-label="PAYANA — Bagalkote heritage">
      <div className="pi-scene relative mx-auto h-full w-full max-w-md overflow-hidden">
        <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="pi-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#120403" />
              <stop offset="1" stopColor="#2a0f0b" />
            </linearGradient>
            <linearGradient id="pi-dawn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1e0907" stopOpacity="0" />
              <stop offset="0.42" stopColor="#5a1d14" />
              <stop offset="0.66" stopColor="#c0643a" />
              <stop offset="0.68" stopColor="#3a150f" />
              <stop offset="1" stopColor="#140504" />
            </linearGradient>
            <radialGradient id="pi-sun-core">
              <stop offset="0" stopColor="#fff4d6" />
              <stop offset="0.55" stopColor="#f6c26b" />
              <stop offset="1" stopColor="#e08a3c" />
            </radialGradient>
            <radialGradient id="pi-sun-glow">
              <stop offset="0" stopColor="#f6b25a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#f6b25a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="pi-stone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8a3a22" />
              <stop offset="1" stopColor="#3a150f" />
            </linearGradient>
            <linearGradient id="pi-cliff" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6b2616" />
              <stop offset="1" stopColor="#240b07" />
            </linearGradient>
            <linearGradient id="pi-fadeDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id="pi-reflect-mask">
              <rect x="0" y="540" width="400" height="200" fill="url(#pi-fadeDown)" />
            </mask>
            <clipPath id="pi-above">
              <rect x="0" y="0" width="400" height="540" />
            </clipPath>
          </defs>

          {/* sky, then dawn warming over it */}
          <rect width="400" height="800" fill="url(#pi-sky)" />
          <rect className="pi-fade" style={{ ...DL(2.2, 2.2), "--to": 1 } as React.CSSProperties} width="400" height="800" fill="url(#pi-dawn)" />

          {/* sun rising behind the temples */}
          <g clipPath="url(#pi-above)">
            <g className="pi-sun">
              <circle cx="200" cy="420" r="170" fill="url(#pi-sun-glow)" />
              <circle cx="200" cy="420" r="54" fill="url(#pi-sun-core)" />
            </g>
          </g>

          {/* Badami's red sandstone cliffs, with cave mouths */}
          <g className="pi-fade" style={DL(2.0, 1.2)}>
            <path
              fill="url(#pi-cliff)"
              d="M0 540 L0 392 L14 386 L22 396 L36 390 L44 404 L52 400 L60 418 L66 440 L74 470 L90 500 L140 506 L170 498 L200 502 L240 496 L280 504 L318 490 L332 462 L340 436 L350 420 L362 414 L372 402 L386 406 L400 396 L400 540 Z"
            />
            <path fill="none" stroke="#a8573a" strokeOpacity="0.45" strokeWidth="0.8" d="M0 414 L50 420 M0 436 L60 440 M0 458 L68 462 M344 432 L400 428 M338 452 L400 450 M330 474 L400 472" />
            <path fill="none" stroke="#e9c987" strokeOpacity="0.8" strokeWidth="1" d="M8 482 q8 -13 16 0 M30 488 q7 -11 14 0 M50 494 q6 -9 12 0 M372 470 q7 -11 14 0" />
          </g>

          {/* the loom: warp threads, weft bands and the Kasuti tower */}
          <g className="pi-fadeout" style={DL(1.95, 0.7)}>
            {WARP.map((x, i) => (
              <path key={x} className="pi-draw" style={DL(0.05 + i * 0.04, 0.9)} pathLength={1} d={`M${x} 150 V650`} stroke="#d9b36c" strokeOpacity="0.55" strokeWidth="0.8" />
            ))}
            {WEFT.map((y, i) => (
              <path
                key={y}
                className="pi-draw"
                style={DL(0.55 + i * 0.1, 0.55)}
                pathLength={1}
                d={i % 2 ? `M330 ${y} H70` : `M70 ${y} H330`}
                stroke="#c42a36"
                strokeWidth="3.2"
              />
            ))}
            {STITCHES.map((s, i) => (
              <path
                key={i}
                className="pi-stitch"
                style={DL(0.95 + s.r * 0.12 + (i % 11) * 0.012)}
                d={`M${s.x} ${s.y} l7 7 M${s.x + 7} ${s.y} l-7 7`}
                stroke={s.r % 2 ? "#f6ecdc" : "#e04a4f"}
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* stone temples + their reflection in Agastya lake */}
          <Temples />
          <g className="pi-fade" style={{ ...DL(3.5, 1), "--to": 1 } as React.CSSProperties} mask="url(#pi-reflect-mask)">
            <g className="pi-ripple">
              <g transform="translate(0 1080) scale(1 -1)" opacity="0.5">
                <Temples />
              </g>
            </g>
          </g>
          <g className="pi-fade" style={DL(3.6, 1)} stroke="#f6c26b" strokeLinecap="round">
            {[560, 574, 590, 608, 630].map((y, i) => (
              <path key={y} className="pi-ripple" style={{ animationDelay: `${i * 0.3}s` }} d={`M${150 - i * 14} ${y} H${250 + i * 14}`} strokeOpacity={0.5 - i * 0.08} strokeWidth={1.2} strokeDasharray="10 8" />
            ))}
          </g>

          {/* birds crossing at dawn */}
          <g className="pi-bird" fill="none" stroke="#1e0907" strokeWidth="1.6" strokeLinecap="round">
            <path className="pi-flap" d="M0 300 q5 -6 10 0 q5 -6 10 0" />
            <path className="pi-flap" style={{ animationDelay: "0.2s" }} d="M26 290 q4 -5 8 0 q4 -5 8 0" />
          </g>

          {/* lamps drifting up over the water */}
          {SPARKS.map((s, i) => (
            <circle
              key={i}
              className="pi-spark"
              style={{ ...DL(s.dl, s.d), "--rise": `${s.rise}px` } as React.CSSProperties}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#ffd98a"
            />
          ))}
        </svg>

        {/* Ilkal saree "tope teni" borders */}
        <div className="pi-band pi-band-top absolute inset-x-0 top-0" />
        <div className="pi-band pi-band-bottom absolute inset-x-0 bottom-0" />

        {/* act captions */}
        <p className="pi-inout absolute inset-x-0 bottom-[15%] text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-gold" style={DL(0.35, 1.7)}>
          Ilkal looms · <span className="tracking-normal">ಇಳಕಲ್ ಮಗ್ಗ</span>
        </p>
        <p className="pi-inout absolute inset-x-0 bottom-[15%] text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-gold" style={DL(2.15, 1.9)}>
          Chalukya stone · <span className="tracking-normal">ಚಾಲುಕ್ಯ ಶಿಲ್ಪ</span>
        </p>

        {/* wordmark */}
        <div className="absolute inset-x-0 top-[10%] flex flex-col items-center text-center">
          <p className="pi-up text-[10px] font-semibold uppercase tracking-[0.4em] text-gold/90" style={DL(4.3)}>
            Bagalkote · <span className="tracking-normal">ಬಾಗಲಕೋಟೆ</span>
          </p>
          <h1 className="pi-reveal gold-text mt-2 font-sans text-[64px] font-bold leading-none" style={DL(4.5)}>
            ಪಯಣ
          </h1>
          <p className="pi-track mt-3 font-display text-xl font-semibold text-cream" style={DL(5.0)}>
            PAYANA
          </p>
          <span className="pi-line mt-3 block h-px w-28 origin-center bg-linear-to-r from-transparent via-gold to-transparent" style={DL(5.2)} />
          <p className="pi-up mt-3 font-serif text-base italic text-sand" style={DL(5.35)}>
            Badami · Aihole · Pattadakal
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-[8%] flex flex-col items-center px-8 text-center">
          <p className="pi-up font-serif text-lg italic text-cream" style={DL(5.55)}>
            From Ilkal&apos;s looms to Chalukya stone
          </p>
          <p className="pi-up mt-1 text-xs text-sand" style={DL(5.7)}>
            ಇಳಕಲ್ ಮಗ್ಗದಿಂದ ಚಾಲುಕ್ಯರ ಶಿಲೆಯವರೆಗೆ
          </p>
        </div>

        {/* a sweep of light before the app appears */}
        <div className="pi-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-transparent via-white/15 to-transparent" />

        <button
          onClick={onDone}
          className="pi-skip absolute right-4 z-10 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-xs font-semibold text-sand backdrop-blur"
          style={{ top: "calc(30px + env(safe-area-inset-top))" }}
        >
          Skip ›
        </button>
      </div>
    </div>
  );
}
