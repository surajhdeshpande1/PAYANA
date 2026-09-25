import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAYANA · AI Heritage Companion for Bagalkote",
    short_name: "PAYANA",
    description: "Scan monuments, ask in Kannada/Hindi/English, plan crowd-smart trips and support local artisans in Bagalkote.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a0806",
    theme_color: "#1a0806",
    lang: "en-IN",
    categories: ["travel", "education", "navigation"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scan a monument", url: "/scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Ask the guide", url: "/guide?voice=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Plan my day", url: "/trip", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
