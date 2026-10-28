import { Bot, FileText, Fingerprint, Layers, Mail, ScanSearch, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { SampleBanner, SiteFooter, SiteHeader } from "@/components/chrome";
import { LaunchPanel, type LaunchExample } from "@/components/LaunchPanel";
import { HowWeScore } from "@/components/HowWeScore";
import { DOMAIN_META } from "@/components/domain";
import { dataMode } from "@/lib/config";
import { LIVE_EXAMPLES } from "@/lib/examples";
import { exampleShowsForMode } from "@/lib/qloo/client";
import type { DomainKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const DELIVERABLES = [
  { Icon: Trophy, t: "A ranked sponsor deck", d: "Brands with a fit score and the taste evidence behind it." },
  { Icon: Sparkles, t: "Surprise fits", d: "Brands a plain LLM would never have guessed from your topic." },
  { Icon: Mail, t: "A pitch email per brand", d: "Citing what your listeners and the brand's fans both love." },
  { Icon: FileText, t: "A 45-60 second host-read script", d: "Cultural references only from your audience's taste data." },
  { Icon: Layers, t: "A one-page media kit", d: "Your audience's taste profile, ready to print or share." },
];

const STEPS = [
  { Icon: ScanSearch, t: "Resolve and profile the show", d: "Finds the show in the taste graph and maps what its listeners love across film, TV, music, dining, books, places and podcasts." },
  { Icon: Trophy, t: "Find candidate brands", d: "Ranks brands by affinity among your listeners, minus any categories you exclude for brand safety." },
  { Icon: Fingerprint, t: "Check the taste overlap", d: "Profiles each chosen brand's fans and measures how much their taste overlaps with your listeners'." },
  { Icon: ShieldCheck, t: "Score in code, write grounded", d: "Code computes the fit. The pitch and script may only cite entities the API returned, and code checks every one." },
];

export default function Home() {
  const mode = dataMode();
  const examples: LaunchExample[] =
    mode === "sample" ? exampleShowsForMode("sample").slice(0, 5).map((p) => ({ id: p.id, name: p.name, genre: p.genres?.[0] ?? "Podcast" })) : LIVE_EXAMPLES;

  return (
    <>
      <SampleBanner mode={mode} />
      <SiteHeader mode={mode} />
      <main id="main">
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:gap-16 lg:pb-24">
          <div>
            <p className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-label font-medium text-fg-2 shadow-[0_0_0_1px_var(--border-soft)]">
              For independent podcasters and small networks
            </p>
            <h1 className="mt-6 font-display text-[40px] leading-[1.1] sm:text-[52px] lg:text-[56px]">
              Find the sponsors your listeners already love. <span className="text-muted">Get the pitch written.</span>
            </h1>
            <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-fg-2">
              An agent reads your listeners&apos; taste in film, TV, music, dining and books with Qloo, then ranks the brands they love.
            </p>
            <div className="mt-8 max-w-2xl">
              <LaunchPanel examples={examples} />
            </div>
          </div>

          <aside aria-labelledby="deliverables" className="self-end rounded-lg bg-surface p-6 shadow-[0_0_0_1px_var(--border-soft)] sm:p-7">
            <h2 id="deliverables" className="font-display text-[22px] leading-tight">
              In every deck
            </h2>
            <ul className="mt-5 space-y-5 text-[15px]">
              {DELIVERABLES.map(({ Icon, t, d }) => (
                <li key={t} className="flex gap-3.5">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-sm bg-bg">
                    <Icon className="size-[18px] text-fg-2" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="font-medium">{t}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <section aria-labelledby="topic" className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 border-t border-border-soft py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
            <div>
              <h2 id="topic" className="font-display text-[34px] leading-[1.15] sm:text-[40px]">
                Your topic isn&apos;t your audience.
              </h2>
              <p className="mt-5 max-w-[62ch] leading-relaxed text-fg-2">
                Ask a chatbot who should sponsor a true-crime show and you&apos;ll get the brands every true-crime show already runs, because it only knows the topic. Your
                listeners are more specific: they share films, artists, restaurants and books, and so do the fans of brands you&apos;d never have thought to pitch.
              </p>
              <p className="mt-4 max-w-[62ch] leading-relaxed text-fg-2">
                Every deck puts the plain-LLM guess next to the taste-grounded picks and marks the{" "}
                <span className="whitespace-nowrap rounded-full bg-accent-wash px-2 py-0.5 text-sm font-medium text-accent-text">Surprise fits</span> only the taste graph
                could find.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 self-center sm:grid-cols-2">
              <div className="rounded-lg bg-surface p-5 shadow-[0_0_0_1px_var(--border-soft)]">
                <div className="flex items-center gap-2 font-medium">
                  <Bot className="size-[18px] text-muted" strokeWidth={1.75} aria-hidden="true" /> Plain LLM
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">Sees the show&apos;s name and topic. Guesses the category-default sponsors.</p>
              </div>
              <div className="rounded-lg bg-accent-wash p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_30%,transparent)]">
                <div className="flex items-center gap-2 font-medium text-accent-text">
                  <Fingerprint className="size-[18px]" strokeWidth={1.75} aria-hidden="true" /> HostRead with Qloo
                </div>
                <p className="mt-2 text-sm leading-relaxed text-fg-2">Sees what the listeners love across domains, and which brands&apos; fans love the same things.</p>
              </div>
              <ul aria-label="Taste domains" className="flex flex-wrap gap-2 sm:col-span-2">
                {(Object.keys(DOMAIN_META) as DomainKey[]).map((d) => {
                  const M = DOMAIN_META[d];
                  return (
                    <li key={d} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[13px] text-fg-2 shadow-[0_0_0_1px_var(--border-soft)]">
                      <M.Icon className="size-3.5 text-muted" strokeWidth={1.75} aria-hidden="true" /> {M.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section id="how" aria-labelledby="how-h" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 id="how-h" className="font-display text-[34px] leading-[1.15] sm:text-[40px]">
              How the agent works
            </h2>
            <p className="mt-4 max-w-[48ch] leading-relaxed text-fg-2">
              An LLM plans the run and calls tools. Every tool is backed by Qloo&apos;s taste graph or by deterministic code, and you watch each step as it happens.
            </p>
          </div>
          <ol className="divide-y divide-border-soft border-y border-border-soft">
            {STEPS.map(({ Icon, t, d }) => (
              <li key={t} className="flex gap-4 py-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-accent-wash">
                  <Icon className="size-5 text-accent-text" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-[21px] leading-snug">{t}</h3>
                  <p className="mt-1.5 max-w-[62ch] leading-relaxed text-fg-2">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="scoring" aria-label="How we score" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6 lg:pb-24">
          <HowWeScore />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
