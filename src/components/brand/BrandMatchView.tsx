"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Link2, LoaderCircle, Mail, ScanSearch, TriangleAlert } from "lucide-react";
import { SampleBanner, SiteFooter, SiteHeader } from "../chrome";
import { DOMAIN_META, EntityImage, EvidenceChip } from "../domain";
import { showHref } from "../LaunchPanel";
import { CopyButton } from "../run/CopyButton";
import { FitScore } from "../run/BrandCard";
import { BrandScoring } from "./BrandScoring";
import { brandHref } from "./BrandLaunch";
import type { BrandEntity, BrandMatchResult, DomainKey, PodcastMatch } from "@/lib/types";

type State =
  | { status: "loading" }
  | { status: "done"; result: BrandMatchResult; cached: boolean }
  | { status: "error"; message: string; code?: string };

export interface BrandMatchViewProps {
  id?: string;
  name?: string;
  q?: string;
  initialMode: "live" | "sample";
}

export function BrandMatchView(props: BrandMatchViewProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams();
    if (props.id) qs.set("id", props.id);
    if (props.name) qs.set("name", props.name);
    if (props.q) qs.set("q", props.q);
    setState({ status: "loading" });
    fetch(`/api/brand?${qs}`, { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json()) as { result?: BrandMatchResult; cached?: boolean; error?: string; code?: string };
        if (!json.result) return setState({ status: "error", message: json.error ?? "That didn't work. Please try again.", code: json.code });
        setState({ status: "done", result: json.result, cached: Boolean(json.cached) });
        // A name search resolves to an ID; make the address bar shareable without re-fetching.
        if (!props.id) window.history.replaceState(null, "", brandHref({ id: json.result.brand.id, name: json.result.brand.name }));
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setState({ status: "error", message: err instanceof Error && err.name === "TimeoutError" ? "That took too long." : "Network error. Please try again." });
      });
    return () => ctrl.abort();
  }, [props.id, props.name, props.q]);

  const result = state.status === "done" ? state.result : undefined;
  const mode = result?.mode ?? props.initialMode;
  const brand = result?.brand;
  const title = brand?.name ?? props.name ?? props.q ?? "Brand";

  return (
    <>
      <SampleBanner mode={mode} />
      <SiteHeader mode={mode} />
      <main id="main" className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <Header brand={brand} title={title} />

        {state.status === "error" && (
          <div role="alert" className="mt-6 flex flex-col gap-4 border border-accent bg-accent-wash p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-accent-text" aria-hidden="true" />
              <div>
                <div className="font-semibold">{state.code === "RATE_LIMITED" ? "Taking a breather" : state.code === "NOT_FOUND" ? "Brand not found" : "That didn't work"}</div>
                <p className="mt-1 text-sm leading-relaxed text-fg-2">{state.message}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href="/brands" className="btn btn-secondary">
                New search
              </Link>
              {state.code !== "RATE_LIMITED" && state.code !== "NOT_FOUND" && (
                <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            {state.status === "loading" && <Loading name={title} />}
            {result && (
              <>
                <p className="max-w-[68ch] leading-relaxed text-fg-2">
                  Qloo returned {result.stats.candidates} podcasts for fans of {result.brand.name}. The top {result.matches.length} got the taste-overlap check, ranked by fit below.
                </p>
                {result.matches.map((m) => (
                  <MatchCard key={m.podcast.id} match={m} brand={result.brand} />
                ))}
              </>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="About this brand's fans">
            {result ? (
              <>
                <FanProfile result={result} />
                {result.more.length > 0 && <MorePodcasts result={result} />}
                <p className="px-1 text-label text-muted tabular">
                  {state.status === "done" && state.cached
                    ? "Served from cache, no new Qloo calls."
                    : `${result.stats.apiCalls} Qloo calls in ${(result.stats.ms / 1000).toFixed(1)} s. No LLM.`}
                </p>
              </>
            ) : state.status === "loading" ? (
              <div className="frame p-5">
                <div className="skeleton h-4 w-40" />
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="skeleton h-7 w-full" />
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="mt-10">
          <BrandScoring compact />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Header({ brand, title }: { brand?: BrandEntity; title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) await navigator.share({ title: `${title}: podcast matches by HostRead`, url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* user cancelled */
    }
  };
  return (
    <div>
      <Link href="/brands" className="inline-flex min-h-9 items-center gap-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-muted transition-colors duration-150 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> New brand search
      </Link>
      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {brand ? <EntityImage src={brand.image} name={brand.name} className="size-16 text-lg" /> : <div className="skeleton size-16" />}
          <div className="min-w-0">
            <p className="eyebrow">Podcasts whose listeners love</p>
            <h1 className="mt-1 truncate font-display text-[34px] leading-[1.05] tracking-[-0.04em] sm:text-[48px]">{title}</h1>
            {brand?.category && <div className="mt-1 text-sm text-muted">{brand.category}</div>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={share} className="btn btn-secondary">
            {copied ? <Check className="size-4 text-success-text" aria-hidden="true" /> : <Link2 className="size-4" strokeWidth={1.75} aria-hidden="true" />} {copied ? "Link copied" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Loading({ name }: { name: string }) {
  const steps = [
    `Ranking podcasts by affinity among ${name} fans`,
    "Mapping what those fans love in film, TV, music, books and food & drink",
    "Checking how much each top show's listeners share those tastes",
  ];
  return (
    <>
      <div className="panel p-5 sm:p-6" role="status" aria-live="polite">
        <div className="flex items-center gap-2 font-semibold">
          <LoaderCircle className="size-4 animate-spin text-accent-text" aria-hidden="true" /> Matching podcasts, usually 10 to 20 seconds
        </div>
        <ol className="mt-4 space-y-2 text-[15px] text-fg-2">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="font-mono text-label text-muted tabular">{String(i + 1).padStart(2, "0")}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="frame p-5 sm:p-6" aria-hidden="true">
          <div className="flex gap-4">
            <div className="skeleton size-12" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-6 w-2/3" />
            </div>
            <div className="skeleton h-[86px] w-[84px]" />
          </div>
          <div className="mt-5 flex gap-1.5">
            <div className="skeleton h-7 w-28" />
            <div className="skeleton h-7 w-32" />
            <div className="skeleton h-7 w-24" />
          </div>
        </div>
      ))}
    </>
  );
}

const listOf = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? ""));

/** Outreach note from the brand to the show. Template only: it cites nothing but the shared tastes on the card. */
export function outreachNote(brand: BrandEntity, m: PodcastMatch): string {
  const shared = listOf(m.topEvidence.map((e) => e.entity.name));
  const why = shared
    ? `Qloo's taste data shows your listeners and our fans love the same things: ${shared}.`
    : `Qloo's taste data puts your show among the podcasts our fans like most.`;
  return [
    `Subject: ${brand.name} x ${m.podcast.name}`,
    "",
    `Hi ${m.podcast.name} team,`,
    "",
    `I work on partnerships at ${brand.name}. ${why} That makes your show a natural home for a host-read ad.`,
    "",
    "Could you send your rates and upcoming availability?",
    "",
    "Thanks,",
    "[Your name]",
    brand.name,
  ].join("\n");
}

type Tab = "evidence" | "note";

const tabBtn = (active: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 border-b-2 font-mono text-[12px] font-bold uppercase tracking-[0.08em] transition-colors duration-150 ${
    active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
  }`;

function MatchCard({ match: m, brand }: { match: PodcastMatch; brand: BrandEntity }) {
  const [tab, setTab] = useState<Tab | null>(null);
  const toggle = (t: Tab) => setTab((cur) => (cur === t ? null : t));
  const p = m.podcast;
  const panelId = `match-${p.id}-panel`;
  const note = outreachNote(brand, m);
  const byDomain = new Map<DomainKey, typeof m.evidence>();
  for (const e of m.evidence) byDomain.set(e.domain, [...(byDomain.get(e.domain) ?? []), e]);
  const parts = [
    { label: "Affinity", value: 60 * m.score.affinity, max: 60, hint: "Qloo affinity of the podcast among the brand's fans, normalised across candidates" },
    { label: "Overlap", value: 40 * m.score.overlap, max: 40, hint: "Shared tastes between the brand's fans and the listeners, scaled to the shortlist's best" },
  ];

  return (
    <article className="frame rise" aria-labelledby={`match-${p.id}-name`}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <EntityImage src={p.image} name={p.name} className="size-12" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow tabular">No. {String(m.rank).padStart(2, "0")}</span>
              {p.sample && <span className="tag tag-warn">Sample</span>}
            </div>
            <h3 id={`match-${p.id}-name`} className="mt-1.5 font-display text-[22px] leading-tight">
              {p.name}
            </h3>
            {p.genres?.length ? <div className="mt-0.5 text-sm text-muted">{p.genres.join(", ")}</div> : null}
          </div>
          <FitScore value={m.fit} within="this brand's shortlist" />
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[13px] text-fg-2">{brand.name} fans and these listeners both love</p>
          {m.topEvidence.length ? (
            <div className="flex flex-wrap gap-1.5">
              {m.topEvidence.map((e) => (
                <EvidenceChip key={`${e.domain}-${e.entity.id}`} domain={e.domain} name={e.entity.name} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">No shared favourites scored 0.75 or higher, so this pick rests on affinity.</p>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-4 sm:gap-6">
          {parts.map((x) => (
            <div key={x.label} title={x.hint}>
              <dt className="eyebrow">{x.label}</dt>
              <dd className="mt-1 text-sm font-semibold tabular">
                {x.value.toFixed(0)}
                <span className="font-normal text-muted">/{x.max}</span>
              </dd>
              <div className="mt-1.5 h-1.5 bg-accent-track" aria-hidden="true">
                <div className="h-full bg-accent" style={{ width: `${(x.value / x.max) * 100}%` }} />
              </div>
            </div>
          ))}
          <div title="Raw Qloo affinity of this podcast among the brand's fans (0 to 1)">
            <dt className="eyebrow">Qloo affinity</dt>
            <dd className="mt-1 text-sm font-semibold tabular">{m.score.rawAffinity !== undefined ? m.score.rawAffinity.toFixed(2) : "n/a"}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border-soft px-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4">
          <button type="button" onClick={() => toggle("evidence")} aria-expanded={tab === "evidence"} aria-controls={panelId} className={tabBtn(tab === "evidence")}>
            <ScanSearch className="size-3.5" strokeWidth={2} aria-hidden="true" /> Evidence
            <ChevronDown className={`size-3.5 transition-transform duration-150 ${tab === "evidence" ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => toggle("note")} aria-expanded={tab === "note"} aria-controls={panelId} className={tabBtn(tab === "note")}>
            <Mail className="size-3.5" strokeWidth={2} aria-hidden="true" /> Outreach note
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 py-2.5">
          <CopyButton text={note} label="Copy outreach note" />
          <Link href={showHref({ id: p.id, name: p.name }, [])} className="btn btn-secondary btn-sm" title="See this show's own sponsor deck">
            Show&apos;s sponsor deck <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {tab === "evidence" && (
        <div id={panelId} className="border-t border-border-soft bg-bg px-5 py-5 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {[...byDomain.entries()].map(([d, list]) => {
              const M = DOMAIN_META[d];
              return (
                <div key={d}>
                  <div className="flex items-center justify-between gap-2 border-b border-border-soft pb-1.5 text-[13px] font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <M.Icon className="size-3.5 text-muted" strokeWidth={2} aria-hidden="true" /> {M.label}
                    </span>
                    <span className="font-mono text-label font-normal text-muted tabular">{((m.perDomain[d] ?? 0) * 100).toFixed(1)}% overlap</span>
                  </div>
                  <table className="mt-1.5 w-full text-[13px]">
                    <caption className="sr-only">
                      {M.label} loved by {brand.name} fans and by {p.name} listeners, with Qloo affinities
                    </caption>
                    <thead className="sr-only">
                      <tr>
                        <th scope="col">Title</th>
                        <th scope="col">Affinity among brand fans</th>
                        <th scope="col">Affinity among listeners</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.slice(0, 5).map((e) => (
                        <tr key={e.entity.id}>
                          <td className="break-words py-0.5 pr-2 leading-snug">{e.entity.name}</td>
                          <td className="w-14 py-0.5 text-right font-mono text-label text-muted tabular" title="Qloo affinity among the brand's fans">
                            F {e.brandWeight.toFixed(2)}
                          </td>
                          <td className="w-14 py-0.5 text-right font-mono text-label text-muted tabular" title="Qloo affinity among this show's listeners">
                            L {e.listenerWeight.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {byDomain.size === 0 && <p className="text-[13px] text-muted">None of the fans&apos; top 20 in any domain scored 0.75 or higher with these listeners.</p>}
          </div>
          <p className="mt-5 text-label leading-relaxed text-muted">
            Source: Qloo /v2/insights. {brand.name} fans&apos; top 20 per domain, and this show&apos;s listeners&apos; affinity for the same items. F and L are Qloo affinities (0 to 1).
          </p>
        </div>
      )}

      {tab === "note" && (
        <div id={panelId} className="border-t border-border-soft bg-bg px-5 py-5 sm:px-6">
          <div className="whitespace-pre-wrap border border-border-soft bg-surface p-4 text-[15px] leading-relaxed sm:p-5">{note}</div>
          <p className="mt-3 text-label text-muted">Template, no LLM: it names only the shared tastes shown on this card.</p>
        </div>
      )}
    </article>
  );
}

function FanProfile({ result }: { result: BrandMatchResult }) {
  return (
    <div className="frame p-5">
      <h2 className="font-display text-[19px] leading-snug">What {result.brand.name} fans love</h2>
      <div className="mt-4 space-y-4">
        {/* Books last, as in the chips: affinity lists there lean to heavy nonfiction. */}
        {[...result.fanProfile].sort((a, b) => Number(a.domain === "books") - Number(b.domain === "books")).map((p) => {
          const M = DOMAIN_META[p.domain];
          return (
            <div key={p.domain}>
              <div className="eyebrow inline-flex items-center gap-1.5">
                <M.Icon className="size-3.5" strokeWidth={2} aria-hidden="true" /> {M.label}
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {p.entities.slice(0, 4).map((e) => (
                  <li key={e.id} className="max-w-full border border-border-soft bg-bg px-2 py-0.5 text-[13px]" title={e.subtitle}>
                    <span className="block truncate">{e.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-label text-muted">Top items by Qloo affinity, with {result.brand.name} as the signal.</p>
    </div>
  );
}

function MorePodcasts({ result }: { result: BrandMatchResult }) {
  return (
    <div className="frame p-5">
      <h2 className="font-display text-[19px] leading-snug">Also high affinity</h2>
      <p className="mt-1 text-[13px] text-muted">More podcasts Qloo ranks for these fans, without the overlap check.</p>
      <ul className="mt-3 divide-y divide-border-soft">
        {result.more.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-[14px]">
            <Link href={showHref({ id: p.id, name: p.name }, [])} className="min-w-0 truncate hover:underline">
              {p.name}
            </Link>
            <span className="shrink-0 font-mono text-label text-muted tabular" title="Qloo affinity among the brand's fans">
              {p.affinity !== undefined ? p.affinity.toFixed(2) : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
