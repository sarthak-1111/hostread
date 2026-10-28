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

// An illustrative host, labelled as such on the page. No results are attributed to her.
const STORY = [
  {
    label: "The usual way",
    text: "Dana hosts a small true-crime podcast with no ad-sales team. She asks a chatbot who should sponsor her and gets home security, mattresses and meal kits: the list every true-crime show gets. Her pitches go unanswered.",
  },
  {
    label: "With HostRead",
    text: "She types her show's name. The agent maps what her listeners love across film, TV, music, food and books, and finds a brand whose fans love the same things. The chatbot never mentioned it.",
  },
  {
    label: "What she sends",
    text: "A pitch email naming three tastes her listeners share with that brand's fans, a host-read script built from them, and a one-page media kit.",
  },
];

const STEPS = [
  { Icon: ScanSearch, t: "Resolve and profile the show", d: "Finds the show in the taste graph and maps what its listeners love across film, TV, music, food & drink, books, places and podcasts." },
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
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-14 lg:pb-24">
          <div>
            <p className="eyebrow">For independent podcasters and small networks</p>
            <h1 className="display-xl mt-5">
              Find the sponsors your listeners <span className="title-highlight">already love.</span> Get the pitch written.
            </h1>
            <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-fg-2">
              An agent reads your listeners&apos; taste in film, TV, music, food and books with Qloo, then ranks the brands they love.
            </p>
            <div className="mt-9 max-w-2xl">
              <LaunchPanel examples={examples} />
            </div>
          </div>

          <aside aria-labelledby="deliverables" className="panel self-center p-6 sm:p-7">
            <h2 id="deliverables" className="eyebrow text-fg">
              In every deck
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

        <section aria-labelledby="topic" className="border-y border-border-soft bg-surface/70">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
            <div>
              <p className="eyebrow">One host&apos;s story, illustrative</p>
              <h2 id="topic" className="mt-4 font-display text-[34px] leading-[1.05] sm:text-[44px]">
                Your topic isn&apos;t your audience.
              </h2>
              <ol className="mt-7 max-w-[62ch] divide-y divide-border-soft border-y border-border-soft">
                {STORY.map(({ label, text }) => (
                  <li key={label} className="grid gap-1.5 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-5">
                    <span className="eyebrow pt-1">{label}</span>
                    <p className="leading-relaxed text-fg-2">{text}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-5 max-w-[62ch] leading-relaxed text-fg-2">
                Every deck puts the plain-LLM guess next to the taste-grounded picks and marks the <span className="tag tag-accent align-middle">Surprise fits</span> only the
                taste graph could find.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 self-center sm:grid-cols-2">
              <div className="frame p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <Bot className="size-[18px] text-muted" strokeWidth={1.75} aria-hidden="true" /> Plain LLM
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">Sees Dana&apos;s topic. Suggests the sponsors it gives every true-crime show.</p>
              </div>
              <div className="panel p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <Fingerprint className="size-[18px] text-accent-text" strokeWidth={1.75} aria-hidden="true" /> HostRead with Qloo
                </div>
                <p className="mt-2 text-sm leading-relaxed text-fg-2">Sees what Dana&apos;s listeners love, and which brands&apos; fans love the same things.</p>
              </div>
              <ul aria-label="Taste domains" className="flex flex-wrap gap-1.5 sm:col-span-2">
                {(Object.keys(DOMAIN_META) as DomainKey[]).map((d) => {
                  const M = DOMAIN_META[d];
                  return (
                    <li key={d} className="tag">
                      <M.Icon className="size-3.5 text-muted" strokeWidth={2} aria-hidden="true" /> {M.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section id="how" aria-labelledby="how-h" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 id="how-h" className="font-display text-[34px] leading-[1.05] sm:text-[44px]">
              How the agent works
            </h2>
            <p className="mt-4 max-w-[48ch] leading-relaxed text-fg-2">
              An LLM plans the run and calls tools. Every tool is backed by Qloo&apos;s taste graph or by deterministic code, and you watch each step as it happens.
            </p>
          </div>
          <ol className="frame divide-y divide-border-soft">
            {STEPS.map(({ Icon, t, d }) => (
              <li key={t} className="flex gap-4 p-5 sm:p-6">
                <span className="grid size-10 shrink-0 place-items-center border border-border-soft bg-bg">
                  <Icon className="size-5 text-accent-text" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-[19px] leading-snug">{t}</h3>
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
