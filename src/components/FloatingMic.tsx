"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic } from "lucide-react";
import { useApp } from "@/lib/store";

const HIDE = ["/guide", "/scan", "/share", "/admin", "/artisans/register"];

export default function FloatingMic() {
  const path = usePathname() || "/";
  const { t, demoStep } = useApp();
  if (HIDE.some((h) => path.startsWith(h)) || demoStep !== null) return null;
  return (
    <Link
      href="/guide?voice=1"
      aria-label={t("tile.ask")}
      className="no-print pulse-ring fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-gold-light/60 text-maroon-950 shadow-xl sm:right-[calc(50%-14rem+1rem)]"
      style={{
        bottom: "calc(92px + env(safe-area-inset-bottom))",
        background: "linear-gradient(180deg,#f7d997,#e8b45a 60%,#c9923f)",
      }}
    >
      <Mic size={24} strokeWidth={2.3} />
    </Link>
  );
}
