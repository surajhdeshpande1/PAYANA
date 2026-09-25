"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { DEMO_STEPS, DEMO_SCAN_SITE } from "@/lib/demo";
import { useApp } from "@/lib/store";
import { track } from "@/lib/analytics";

export default function DemoTour() {
  const { demoStep, setDemoStep, setTimeMode, stamp, lang } = useApp();
  const router = useRouter();
  const path = usePathname();
  const lastStep = useRef<number | null>(null);

  // Presenter-only entry point: open the app with ?demo=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") setDemoStep(0);
  }, [setDemoStep]);

  useEffect(() => {
    if (demoStep === null) {
      lastStep.current = null;
      return;
    }
    if (lastStep.current === demoStep) return;
    lastStep.current = demoStep;
    const step = DEMO_STEPS[demoStep];
    if (!step) return;
    if (step.id === "intro") {
      setTimeMode("sunday");
      track("demo", { lang });
    }
    if (step.id === "passport") stamp(DEMO_SCAN_SITE);
    if (path !== step.route) router.push(step.route);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [demoStep, path, router, setTimeMode, stamp, lang]);

  if (demoStep === null) return null;
  const step = DEMO_STEPS[demoStep];
  if (!step) return null;
  const last = demoStep === DEMO_STEPS.length - 1;

  const finish = () => {
    setDemoStep(null);
    setTimeMode("live");
  };

  return (
    <div
      className="no-print fixed inset-x-0 z-[60] mx-auto max-w-md px-3"
      style={{ bottom: "calc(84px + env(safe-area-inset-bottom))" }}
    >
      <div className="fade-up rounded-2xl border border-teal/60 bg-maroon-900/95 p-4 shadow-2xl backdrop-blur-xl" key={demoStep}>
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-teal">
            <Sparkles size={13} /> Demo {demoStep + 1}/{DEMO_STEPS.length}
          </span>
          <button onClick={finish} aria-label="Close demo" className="rounded-full p-1 text-sand hover:text-cream">
            <X size={16} />
          </button>
        </div>
        <h3 className="font-serif text-lg font-semibold text-gold-light">{step.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-sand">{step.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            className="btn-ghost px-3 py-2"
            disabled={demoStep === 0}
            onClick={() => setDemoStep(Math.max(0, demoStep - 1))}
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex flex-1 justify-center gap-1.5">
            {DEMO_STEPS.map((s, i) => (
              <span key={s.id} className={`h-1.5 rounded-full transition-all ${i === demoStep ? "w-6 bg-teal" : "w-1.5 bg-sand/30"}`} />
            ))}
          </div>
          <button className="btn-teal px-4 py-2" onClick={() => (last ? finish() : setDemoStep(demoStep + 1))}>
            {last ? "Finish" : "Next"} {!last && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
