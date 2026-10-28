import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMatchView } from "@/components/brand/BrandMatchView";
import { dataMode } from "@/lib/config";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const sp = await searchParams;
  const name = one(sp.name) ?? one(sp.q);
  return { title: name ? `${name}: podcast matches | HostRead` : "Podcast matches | HostRead" };
}

/** Podcasts whose listeners love a brand: by Qloo ID (?id=&name=) or by name (?q=). */
export default async function BrandMatchPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const id = one(sp.id)?.slice(0, 160);
  const q = one(sp.q)?.trim().slice(0, 80);
  if (!id && !q) redirect("/brands");
  return <BrandMatchView id={id} name={one(sp.name)?.slice(0, 160)} q={id ? undefined : q} initialMode={dataMode()} />;
}
