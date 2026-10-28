import { Bot, FileText, Fingerprint, Layers, Mail, Mic, ScanSearch, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { SampleBanner, SiteFooter, SiteHeader } from "@/components/chrome";
import { LaunchPanel, type LaunchExample } from "@/components/LaunchPanel";
import { HowWeScore } from "@/components/HowWeScore";
import { DOMAIN_META } from "@/components/domain";
import { dataMode } from "@/lib/config";
import { LIVE_EXAMPLES } from "@/lib/examples";
import { exampleShowsForMode } from "@/lib/qloo/client";
import type { DomainKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function Home() {
  const mode = dataMode();
  const examples: LaunchExample[] =
    mode === "sample" ? exampleShowsForMode("sample").slice(0, 5).map((p) => ({ id: p.id, name: p.name, genre: p.genres?.[0] ?? "Podcast" })) : LIVE_EXAMPLES;

  return (
    <>
      <SampleBanner mode={mode} />
      <SiteHeader mode={mode} />
      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
              <Mic className="size-3.5 text-accent" aria-hidden="true" /> For independent podcasters &amp; small networks
            </div>
            <h1 className="mt-5 font-serif text-[44px] leading-[1.02] tracking-[-0.01em] sm:text-[64px]">
              Find the sponsors your listeners already love.
              <span className="block italic text-accent">Get the pitch written.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
              HostRead&apos;s agent reads your audience&apos;s taste across film, TV, music, dining, books and places with Qloo&apos;s taste graph, finds the brands those
              listeners over-index on, and hands you the evidence, a pitch email and a host-read ad script.
            </p>
            <div className="mt-8 max-w-2xl">
              <LaunchPanel examples={examples} />
            </div>
          </div>

          <aside className="self-end rounded-2xl border border-line bg-surface p-6 shadow-card">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">What you get</div>
            <ul className="mt-4 space-y-4 text-[15px]">
              {[
                { Icon: Trophy, t: "A ranked sponsor deck", d: "Brands with a fit score and the taste evidence behind it." },
                { Icon: Sparkles, t: "Surprise fits", d: "Brands a plain LLM would never have guessed from your topic." },
                { Icon: Mail, t: "A pitch email per brand", d: "Citing what your listeners and their fans both love." },
                { Icon: FileText, t: "A 45–60s host-read script", d: "Cultural references only from your audience's taste data." },
                { Icon: Layers, t: "A one-page media kit", d: "Your audience's taste profile, ready to print or share." },
              ].map(({ Icon, t, d }) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2">
                    <Icon className="size-4 text-ink-2" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="font-medium">{t}</span>
                    <span className="block text-sm leading-snug text-ink-3">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        {/* Obvious vs surprising */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="font-serif text-4xl leading-tight">Your topic isn&apos;t your audience.</h2>
              <p className="mt-4 max-w-lg leading-relaxed text-ink-2">
                Ask a chatbot who should sponsor a true-crime show and you&apos;ll get the brands every true-crime show already runs. It only knows the topic. Your
                listeners are more specific than that: they share films, artists, restaurants and books — and so do the fans of brands you&apos;d never have thought to
                pitch.
              </p>
              <p className="mt-4 max-w-lg leading-relaxed text-ink-2">
                HostRead puts both side by side. Every deck includes the plain-LLM guess next to the taste-grounded picks, and flags the{" "}
                <span className="rounded-full bg-violet-soft px-2 py-0.5 text-sm font-medium text-violet">Surprise fits</span> only the taste graph could find.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 self-center">
              <div className="rounded-2xl border border-line bg-surface-2 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bot className="size-4 text-ink-3" aria-hidden="true" /> Plain LLM
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-3">Sees the show&apos;s name and topic. Guesses the category-default sponsors.</p>
              </div>
              <div className="rounded-2xl border border-violet/30 bg-violet-soft p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-violet">
                  <Fingerprint className="size-4" aria-hidden="true" /> HostRead + Qloo
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">Sees what the listeners love in six domains, and which brands&apos; fans love the same things.</p>
              </div>
              <div className="col-span-2 flex flex-wrap gap-1.5 rounded-2xl border border-line p-4">
                {(Object.keys(DOMAIN_META) as DomainKey[]).map((d) => {
                  const M = DOMAIN_META[d];
                  return (
                    <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[13px]">
                      <M.Icon className={`size-3.5 ${M.tint}`} aria-hidden="true" /> {M.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="font-serif text-4xl">How the agent works</h2>
          <p className="mt-3 max-w-2xl text-ink-2">
            An LLM plans and calls tools; every tool is backed by Qloo&apos;s taste graph or deterministic code. You watch each step live.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: ScanSearch, t: "Resolve & profile", d: "Finds your show in the taste graph and maps what its listeners love across six domains." },
              { Icon: Trophy, t: "Find candidate brands", d: "Ranks brands by affinity among your listeners, minus any categories you exclude." },
              { Icon: Fingerprint, t: "Check the overlap", d: "Profiles each brand's fans and measures how much their taste overlaps with your listeners'." },
              { Icon: ShieldCheck, t: "Score & write, grounded", d: "Code scores the fit. The pitch and script may only cite entities the API returned — checked in code." },
            ].map(({ Icon, t, d }, i) => (
              <li key={t} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-accent" aria-hidden="true" />
                  <span className="font-mono text-xs text-ink-3">0{i + 1}</span>
                </div>
                <div className="mt-4 font-semibold">{t}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="scoring" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-6">
          <HowWeScore />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
