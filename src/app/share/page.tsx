"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { ChevronLeft, Copy, Printer } from "lucide-react";
import { useApp } from "@/lib/store";

export default function SharePage() {
  const { t } = useApp();
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const u = window.location.origin;
    setUrl(u);
    QRCode.toDataURL(u, { width: 720, margin: 1, color: { dark: "#1a0806", light: "#fff8ec" }, errorCorrectionLevel: "M" }).then(setQr);
  }, []);

  return (
    <div className="min-h-dvh px-5 py-5 print:bg-white">
      <Link href="/" className="no-print mb-4 inline-flex items-center gap-1 text-sm text-gold-light">
        <ChevronLeft size={18} /> {t("back")}
      </Link>
      <div className="mx-auto max-w-sm rounded-3xl border-2 border-gold/60 p-6 text-center print:border-black" style={{ background: "linear-gradient(180deg,#461910,#260c08)" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold/80">AI to Redesign Tourism · Bagalkote 2026</p>
        <h1 className="gold-text mt-2 font-display text-6xl tracking-wide">PAYANA</h1>
        <p className="font-serif italic text-sand">ಪಯಣ · पयण</p>
        <p className="mt-2 text-sm text-cream">{t("tagline")}</p>
        <div className="mx-auto mt-5 w-64 rounded-2xl bg-[#fff8ec] p-3 shadow-2xl">
          {qr ? <img src={qr} alt="QR code" className="h-full w-full" /> : <div className="aspect-square shimmer rounded-xl" />}
        </div>
        <p className="mt-4 font-serif text-xl text-gold-light">{t("share.title")}</p>
        <p className="mt-1 break-all text-sm font-semibold text-teal">{url.replace(/^https?:\/\//, "")}</p>
        <p className="mt-2 text-xs text-sand">{t("share.sub")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[10px] text-sand">
          {["📷 Scan monuments", "🎙️ Kannada · Hindi · English", "🧭 Crowd-smart trips", "🧵 Local artisans"].map((x) => (
            <span key={x} className="rounded-full border border-gold/30 px-2.5 py-1">
              {x}
            </span>
          ))}
        </div>
      </div>
      <div className="no-print mx-auto mt-5 flex max-w-sm gap-2">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
          className="btn-ghost flex-1"
        >
          <Copy size={16} /> {copied ? t("copied") : t("copy")}
        </button>
        <button onClick={() => window.print()} className="btn-gold flex-1">
          <Printer size={16} /> {t("print")}
        </button>
      </div>
      <p className="no-print mx-auto mt-4 max-w-sm text-center text-xs text-muted">{t("share.install")}</p>
    </div>
  );
}
