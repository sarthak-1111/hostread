import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowRightLeft, Fingerprint, Mail, Trophy } from "lucide-react";
import { SampleBanner, SiteFooter, SiteHeader } from "@/components/chrome";
import { BrandLaunch } from "@/components/brand/BrandLaunch";
import type { LaunchExample } from "@/components/LaunchPanel";
import { BrandScoring } from "@/components/brand/BrandScoring";
import { dataMode } from "@/lib/config";
import { BRAND_EXAMPLES } from "@/lib/examples";
import { exampleBrandsForMode } from "@/lib/qloo/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HostRead for brands: podcasts your fans already love",
  description: "Rank the podcasts whose listeners already love your brand, with the tastes both audiences share as evidence.",
};

const DELIVERABLES = [
  { Icon: Trophy, t: "Podcasts ranked by fit", d: "Affinity among your fans plus shared taste, scored in code." },
  { Icon: Fingerprint, t: "Shared tastes as evidence", d: "Films, shows, artists, books and food brands both audiences love." },
  { Icon: Mail, t: "An outreach note per show", d: "Cites only tastes both audiences share. No invented claims." },
  { Icon: ArrowRightLeft, t: "Each show's sponsor deck", d: "One click to see the match from the host's side." },
];

export default function BrandsHome() {
  const mode = dataMode();
  const examples: LaunchExample[] =
    mode === "sample" ? exampleBrandsForMode("sample").map((b) => ({ id: b.id, name: b.name, genre: b.category ?? "Brand" })) : BRAND_EXAMPLES;

  return (
    <>
      <SampleBanner mode={mode} />
      <SiteHeader mode={mode} />
      <main id="main">
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-14 lg:pb-24">
          <div>
            <p className="eyebrow">For brands and agencies</p>
            <h1 className="display-xl mt-5">
              Find the podcasts whose listeners <span className="title-highlight">already love</span> your brand.
            </h1>
            <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-fg-2">
              Qloo ranks podcasts by how much their listeners like your brand. HostRead then checks which of your fans&apos; favourite films, shows, artists, books and food brands
              those listeners love too.
            </p>
            <div className="mt-9 max-w-2xl">
              <BrandLaunch examples={examples} />
            </div>
            <p className="mt-8 text-[15px] text-fg-2">
              Hosting a podcast instead?{" "}
              <Link href="/" className="inline-flex items-center gap-1 font-medium text-fg underline decoration-border underline-offset-4 hover:decoration-accent">
                Find your sponsors <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </p>
          </div>

          <aside aria-labelledby="deliverables" className="panel self-center p-6 sm:p-7">
            <h2 id="deliverables" className="eyebrow text-fg">
              In every match list
            </h2>
            <ul className="mt-5 divide-y divide-border-soft text-[15px]">
              {DELIVERABLES.map(({ Icon, t, d }) => (
                <li key={t} className="flex gap-3.5 py-3.5 first:pt-0 last:pb-0">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center border border-border-soft bg-bg">
                    <Icon className="size-[18px] text-fg" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="font-semibold">{t}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <section aria-label="How brand matches are scored" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
          <BrandScoring />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
