"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, House, Map, Route, Store } from "lucide-react";
import { useApp } from "@/lib/store";

const ITEMS = [
  { href: "/", key: "nav.home", Icon: House },
  { href: "/explore", key: "nav.explore", Icon: Map },
  { href: "/scan", key: "nav.scan", Icon: Camera, center: true },
  { href: "/trip", key: "nav.trip", Icon: Route },
  { href: "/artisans", key: "nav.artisans", Icon: Store },
];

export default function BottomNav() {
  const path = usePathname() || "/";
  const { t } = useApp();
  if (path.startsWith("/share")) return null;

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md">
      <div className="safe-bottom border-t border-gold/20 bg-maroon-950/92 backdrop-blur-xl">
        <ul className="grid grid-cols-5 items-end px-1 pt-1.5 pb-1.5">
          {ITEMS.map(({ href, key, Icon, center }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            if (center) {
              return (
                <li key={href} className="flex justify-center">
                  <Link
                    href={href}
                    aria-label={t(key)}
                    className="-mt-7 flex flex-col items-center gap-1"
                  >
                    <span
                      className={`flex h-[60px] w-[60px] items-center justify-center rounded-full border-4 border-maroon-950 text-maroon-950 shadow-lg ${
                        active ? "" : "pulse-ring"
                      }`}
                      style={{ background: "linear-gradient(180deg,#f7d997,#e8b45a 60%,#c9923f)" }}
                    >
                      <Icon size={26} strokeWidth={2.2} />
                    </span>
                    <span className={`text-[10px] font-semibold ${active ? "text-gold" : "text-sand/80"}`}>{t(key)}</span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex flex-col items-center gap-1 rounded-xl py-1.5 transition ${
                    active ? "text-gold" : "text-sand/70 hover:text-sand"
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
                  <span className="text-[10px] font-medium leading-none">{t(key)}</span>
                  <span className={`h-1 w-1 rounded-full ${active ? "bg-gold" : "bg-transparent"}`} />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
