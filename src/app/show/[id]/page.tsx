import type { Metadata } from "next";
import { RunView } from "@/components/run/RunView";
import { dataMode } from "@/lib/config";
import { parseExclusions } from "@/lib/safety";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const name = one((await searchParams).name);
  return { title: name ? `${name} · sponsor deck · HostRead` : "Sponsor deck · HostRead" };
}

export default async function ShowPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <RunView
      id={decodeURIComponent(id)}
      name={one(sp.name)?.slice(0, 160)}
      exclude={parseExclusions(one(sp.x))}
      view={one(sp.view) === "kit" ? "kit" : undefined}
      initialMode={dataMode()}
    />
  );
}
