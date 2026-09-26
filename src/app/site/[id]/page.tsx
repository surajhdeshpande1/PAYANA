import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITES, getSite, sitePhoto } from "@/lib/sites";
import SiteDetail from "./SiteDetail";

export const dynamicParams = false;

export function generateStaticParams() {
  return SITES.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = getSite(id);
  if (!s) return { title: "PAYANA" };
  return {
    title: `${s.name.en} · PAYANA`,
    description: s.summary.en,
    openGraph: { title: `${s.name.en} · ${s.name.kn}`, description: s.summary.en, images: [sitePhoto(s.id).src] },
  };
}

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getSite(id)) notFound();
  return <SiteDetail id={id} />;
}
