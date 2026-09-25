import type { Metadata, Viewport } from "next";
import { Anton, Noto_Sans_Devanagari, Noto_Sans_Kannada, Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import AppShell from "@/components/AppShell";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", style: ["normal", "italic"] });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const kannada = Noto_Sans_Kannada({ subsets: ["kannada"], variable: "--font-kannada", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap" });

const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "PAYANA · AI Heritage Companion for Bagalkote",
  description:
    "Multilingual, crowd-aware heritage guide for Badami, Aihole, Pattadakal and Bagalkote's hidden gems — scan monuments, ask by voice in Kannada, Hindi or English, plan crowd-smart trips and support local artisans.",
  applicationName: "PAYANA",
  appleWebApp: { capable: true, title: "PAYANA", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "PAYANA · ಪಯಣ",
    description: "Your AI heritage companion for Bagalkote — Badami, Aihole, Pattadakal & hidden gems.",
    images: ["/images/hero.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1a0806",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${anton.variable} ${playfair.variable} ${outfit.variable} ${kannada.variable} ${deva.variable}`}>
      <body className="antialiased">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
