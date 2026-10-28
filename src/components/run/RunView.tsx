"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Bot, Check, FileDown, Link2, Printer, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { ModePill, SampleBanner, SiteFooter, SiteHeader } from "../chrome";
import { EntityImage, EvidenceChip } from "../domain";
import { HowWeScore } from "../HowWeScore";
import { SafetyToggles } from "../SafetyToggles";
import { showHref } from "../LaunchPanel";
import { AgentTrace } from "./AgentTrace";
import { AudienceSnapshot } from "./AudienceSnapshot";
import { BrandCard } from "./BrandCard";
import { ObviousVsSurprising } from "./ObviousVsSurprising";
import { useRun, type RunUiState } from "./useRun";
import { SAFETY_CATEGORIES } from "@/lib/safety";
import type { PitchPack, SafetyCategory } from "@/lib/types";

export interface RunViewProps {
  id?: string;
  q?: string;
  name?: string;
  exclude: SafetyCategory[];
  view?: "kit";
  initialMode: "live" | "sample";
}

export function RunView(props: RunViewProps) {
  const [nonce, setNonce] = useState(0);
  const query = useMemo(() => {
    const qs = new URLSearchParams();
    if (props.id) qs.set("id", props.id);
    if (props.name) qs.set("name", props.name);
    if (props.q) qs.set("q", props.q);
    if (props.exclude.length) qs.set("x", props.exclude.join(","));
    if (nonce) {
      qs.set("fresh", "1");
      qs.set("n", String(nonce));
    }
    return qs.toString();
  }, [props.id, props.name, props.q, props.exclude, nonce]);
  const { state, setPitch } = useRun(query);
  const mode = state.mode ?? props.initialMode;
  const title = state.podcast?.name ?? props.name ?? props.q ?? "Podcast";

  if (props.view === "kit") return <MediaKit state={state} title={title} props={props} />;

  return (
    <>
      <SampleBanner mode={mode} />
      <SiteHeader mode={mode} />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <ShowHeader state={state} title={title} props={props} onRerun={() => setNonce((n) => n + 1)} />

        {state.status === "error" && state.error && (
          <div role="alert" className="mt-6 flex flex-col gap-4 rounded-2xl border border-accent/30 bg-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-accent-ink" />
              <div>
                <div className="font-semibold">{state.error.code === "RATE_LIMITED" ? "Taking a breather" : state.error.code === "NOT_FOUND" ? "Show not found" : "That didn't work"}</div>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{state.error.message}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href="/" className="rounded-lg border border-line-2 bg-surface px-3.5 py-2 text-sm font-medium hover:border-ink/40">
                New search
              </Link>
              {state.error.code !== "RATE_LIMITED" && (
                <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-bg hover:opacity-90">
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="no-print lg:sticky lg:top-20 lg:self-start">
            <AgentTrace steps={state.steps} running={state.status === "running" || state.status === "connecting"} cached={state.cached} stats={state.result?.stats} />
            {state.llm && (
              <p className="mt-2 px-1 font-mono text-[11px] text-ink-3">
                agent model: {state.llm}
                {state.result?.stats.fallbacks.length ? ` · fallbacks: ${state.result.stats.fallbacks.join(", ")}` : ""}
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-6">
            {state.summary && (
              <div className="rise rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
                  <Bot className="size-4" aria-hidden="true" /> Agent&apos;s read
                </div>
                <p className="mt-2 font-serif text-[22px] leading-snug">{state.summary}</p>
              </div>
            )}

            <Deck state={state} props={props} setPitch={setPitch} />
            {(state.deck || state.status === "done") && <ObviousVsSurprising baseline={state.baseline} deck={state.deck ?? []} />}
            {(state.profile || state.status === "running") && (
              <AudienceSnapshot profile={state.profile} demographics={state.demographics} geography={state.geography} podcastName={state.podcast?.name} />
            )}
            <HowWeScore compact />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function ShowHeader({ state, title, props, onRerun }: { state: RunUiState; title: string; props: RunViewProps; onRerun: () => void }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SafetyCategory[]>(props.exclude);
  const p = state.podcast;
  const share = async () => {
    const url = window.location.href.replace(/[?&]view=kit/, "");
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) await navigator.share({ title: `HostRead · ${title}`, url });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* user cancelled */
    }
  };
  const kitHref = () => {
    const u = new URL(window.location.href);
    u.searchParams.set("view", "kit");
    return u.pathname + u.search;
  };
  return (
    <div>
      <Link href="/" className="no-print inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> New search
      </Link>
      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {p ? <EntityImage src={p.image} name={p.name} className="size-16 rounded-xl" /> : <div className="skeleton size-16 rounded-xl" />}
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Sponsor deck</div>
            <h1 className="truncate font-serif text-[34px] leading-tight sm:text-[42px]">{title}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-3">
              {p?.genres?.length ? <span>{p.genres.join(" · ")}</span> : p?.subtitle ? <span>{p.subtitle}</span> : null}
              {props.exclude.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="size-3.5" /> excluding {props.exclude.map((x) => SAFETY_CATEGORIES.find((c) => c.key === x)?.label.toLowerCase() ?? x).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm font-medium hover:border-ink/40">
            {copied ? <Check className="size-4 text-green" /> : <Link2 className="size-4" />} {copied ? "Link copied" : "Share"}
          </button>
          <button
            type="button"
            disabled={state.status !== "done"}
            onClick={() => router.push(kitHref())}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm font-medium hover:border-ink/40 disabled:opacity-40"
          >
            <FileDown className="size-4" /> Media kit
          </button>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm font-medium hover:border-ink/40"
            aria-expanded={editing}
          >
            <ShieldCheck className="size-4" /> Brand safety
          </button>
          {state.status === "done" && !state.cached && (
            <button type="button" onClick={onRerun} className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm font-medium hover:border-ink/40" title="Run the agent again from scratch">
              <RefreshCw className="size-4" /> Re-run
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="no-print mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <SafetyToggles value={draft} onChange={setDraft} compact />
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              router.push(showHref({ id: props.id, name: props.id ? (state.podcast?.name ?? props.name ?? "") : (props.q ?? "") }, draft));
            }}
            className="shrink-0 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-bg hover:opacity-90"
          >
            Apply &amp; re-rank
          </button>
        </div>
      )}
    </div>
  );
}

function Deck({ state, props, setPitch }: { state: RunUiState; props: RunViewProps; setPitch: (id: string, p: PitchPack) => void }) {
  const [writing, setWriting] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const deck = state.deck;
  const running = state.status === "running" || state.status === "connecting";

  const write = async (brandId: string, fit: number) => {
    if (!state.podcast) return;
    setWriting((w) => ({ ...w, [brandId]: true }));
    setErr(null);
    try {
      const res = await fetch("/api/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podcastId: state.podcast.id, brandId, name: props.id ? props.name ?? state.podcast.name : undefined, x: props.exclude.join(","), fit }),
      });
      const json = (await res.json()) as { pitch?: PitchPack; error?: string };
      if (json.pitch) setPitch(brandId, json.pitch);
      else setErr(json.error ?? "Couldn't write that pitch.");
    } catch {
      setErr("Network error while writing the pitch.");
    } finally {
      setWriting((w) => ({ ...w, [brandId]: false }));
    }
  };

  return (
    <section aria-labelledby="deck-h">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="deck-h" className="font-serif text-[28px] leading-tight">
            Ranked sponsors
          </h2>
          <p className="text-sm text-ink-3">Fit scores are relative rankings within this deck, not revenue predictions.</p>
        </div>
        {state.filteredOut && state.filteredOut.length > 0 && (
          <span className="text-[12.5px] text-ink-3" title={state.filteredOut.map((f) => `${f.name} (${f.category})`).join(", ")}>
            <ShieldCheck className="mr-1 inline size-3.5" />
            {state.filteredOut.length} brand{state.filteredOut.length === 1 ? "" : "s"} removed by brand safety
          </span>
        )}
      </div>
      {err && <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{err}</p>}
      {!deck ? (
        running ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  <div className="skeleton size-12" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-40" />
                    <div className="skeleton h-3 w-24" />
                  </div>
                  <div className="skeleton size-14 rounded-full" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="skeleton h-7 w-28 rounded-full" />
                  <div className="skeleton h-7 w-32 rounded-full" />
                  <div className="skeleton h-7 w-24 rounded-full" />
                </div>
              </div>
            ))}
            <p className="text-center text-xs text-ink-3">The agent is mapping tastes — cards appear as soon as scoring finishes.</p>
          </div>
        ) : null
      ) : deck.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-2">No brands could be ranked for this show. Try removing some brand-safety exclusions.</p>
      ) : (
        <div className="space-y-3">
          {deck.map((card) => (
            <BrandCard
              key={card.brand.id}
              card={card}
              pitch={state.pitches[card.brand.id]}
              pitchPending={running && card.rank <= 3}
              writing={!!writing[card.brand.id]}
              onWritePitch={() => write(card.brand.id, card.fit)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MediaKit({ state, title, props }: { state: RunUiState; title: string; props: RunViewProps }) {
  const router = useRouter();
  const deck = state.deck ?? [];
  const mode = state.mode ?? props.initialMode;
  const back = () => {
    const u = new URL(window.location.href);
    u.searchParams.delete("view");
    router.push(u.pathname + u.search);
  };
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={back} className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft className="size-4" /> Back to deck
        </button>
        <div className="flex items-center gap-2">
          <ModePill mode={mode} />
          <button type="button" onClick={() => window.print()} disabled={state.status !== "done"} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-40">
            <Printer className="size-4" /> Print / save PDF
          </button>
        </div>
      </div>
      {mode === "sample" && (
        <p className="mb-4 rounded-lg bg-amber-soft px-3 py-2 text-[13px] font-medium text-amber">SAMPLE DATA — synthetic fixtures, not Qloo output.</p>
      )}
      <header className="flex items-center gap-4 border-b border-line pb-5">
        {state.podcast && <EntityImage src={state.podcast.image} name={state.podcast.name} className="size-16 rounded-xl" />}
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Audience media kit</div>
          <h1 className="font-serif text-[40px] leading-tight">{title}</h1>
          <div className="text-sm text-ink-3">
            {state.podcast?.genres?.join(" · ")}
            {state.result ? ` · generated ${new Date(state.result.createdAt).toLocaleDateString()}` : ""}
          </div>
        </div>
      </header>
      {state.summary && <p className="mt-5 font-serif text-[21px] leading-snug">{state.summary}</p>}
      <div className="mt-6">
        <AudienceSnapshot profile={state.profile} demographics={state.demographics} geography={state.geography} podcastName={state.podcast?.name} />
      </div>
      {deck.length > 0 && (
        <section className="print-avoid mt-6 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-serif text-[26px]">Brands our listeners already love</h2>
          <p className="text-sm text-ink-3">Ranked by HostRead fit (relative, not a revenue forecast).</p>
          <ol className="mt-4 divide-y divide-line">
            {deck.slice(0, 6).map((c) => (
              <li key={c.brand.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-5 font-mono text-xs text-ink-3">{c.rank}</span>
                  <span className="font-medium">{c.brand.name}</span>
                  <span className="font-mono text-xs text-ink-3">fit {c.fit}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                  {c.topEvidence.map((e) => (
                    <EvidenceChip key={e.entity.id} domain={e.domain} name={e.entity.name} compact />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className="mt-6 text-[11.5px] text-ink-3">
        Taste data: Qloo taste graph via HostRead. Affinities describe aggregate audiences, not individuals. {state.status !== "done" ? "Loading…" : ""}
      </p>
    </main>
  );
}
