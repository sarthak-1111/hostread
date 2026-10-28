import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RunView } from "@/components/run/RunView";
import { dataMode } from "@/lib/config";
import { parseExclusions } from "@/lib/safety";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const q = one((await searchParams).q);
  return { title: q ? `${q} · sponsor deck · HostRead` : "Sponsor deck · HostRead" };
}

/** Free-text run: the agent resolves the show itself. */
export default async function RunPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim().slice(0, 160);
  if (!q) redirect("/");
  return <RunView q={q} exclude={parseExclusions(one(sp.x))} view={one(sp.view) === "kit" ? "kit" : undefined} initialMode={dataMode()} />;
}
