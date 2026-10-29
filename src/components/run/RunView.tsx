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

const btn = "btn btn-secondary";
const btnPrimary = "btn btn-primary";

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
      <main id="main" className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <ShowHeader state={state} title={title} props={props} onRerun={() => setNonce((n) => n + 1)} />

        {state.status === "error" && state.error && (
          <div role="alert" className="mt-6 flex flex-col gap-4 border border-accent bg-accent-wash p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-accent-text" aria-hidden="true" />
              <div>
                <div className="font-semibold">{state.error.code === "RATE_LIMITED" ? "Taking a breather" : state.error.code === "NOT_FOUND" ? "Show not found" : "That didn't work"}</div>
                <p className="mt-1 text-sm leading-relaxed text-fg-2">{state.error.message}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href="/" className={btn}>
                New search
              </Link>
              {state.error.code !== "RATE_LIMITED" && (
                <button type="button" onClick={() => window.location.reload()} className={btnPrimary}>
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="no-print lg:sticky lg:top-24 lg:self-start">
            <AgentTrace steps={state.steps} running={state.status === "running" || state.status === "connecting"} cached={state.cached} stats={state.result?.stats} />
            {state.llm && (
              <p className="mt-2.5 px-1 text-label text-muted">
                Agent model: {state.llm}
                {state.result?.stats.fallbacks.length ? `. Fallbacks: ${state.result.stats.fallbacks.join(", ")}` : ""}
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-6">
            {state.summary && (
              <div className="panel rise p-5 sm:p-6">
                <h2 className="eyebrow flex items-center gap-2">
                  <Bot className="size-4" strokeWidth={2} aria-hidden="true" /> The agent&apos;s read on this audience
                </h2>
                <p className="mt-3 max-w-[62ch] text-[18px] leading-relaxed text-fg sm:text-[20px]">{state.summary}</p>
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
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) await navigator.share({ title: `${title}: sponsor deck by HostRead`, url });
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
      <Link href="/" className="no-print inline-flex min-h-9 items-center gap-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-muted transition-colors duration-150 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> New search
      </Link>
      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {p ? <EntityImage src={p.image} name={p.name} className="size-16 text-lg" /> : <div className="skeleton size-16" />}
          <div className="min-w-0">
            <p className="eyebrow">Sponsor deck</p>
            <h1 className="mt-1 truncate font-display text-[34px] leading-[1.05] tracking-[-0.04em] sm:text-[48px]">{title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {p?.genres?.length ? <span>{p.genres.join(", ")}</span> : p?.subtitle ? <span>{p.subtitle}</span> : null}
              {props.exclude.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> Excluding {props.exclude.map((x) => SAFETY_CATEGORIES.find((c) => c.key === x)?.label.toLowerCase() ?? x).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" onClick={share} className={btn}>
            {copied ? <Check className="size-4 text-success-text" aria-hidden="true" /> : <Link2 className="size-4" strokeWidth={1.75} aria-hidden="true" />} {copied ? "Link copied" : "Share"}
          </button>
          <button
            type="button"
            disabled={state.status !== "done"}
            onClick={() => router.push(kitHref())}
            className={`${btn} disabled:opacity-50`}
          >
            <FileDown className="size-4" strokeWidth={1.75} aria-hidden="true" /> Media kit
          </button>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className={btn}
            aria-expanded={editing}
          >
            <ShieldCheck className="size-4" strokeWidth={1.75} aria-hidden="true" /> Brand safety
          </button>
          {state.status === "done" && !state.cached && (
            <button type="button" onClick={onRerun} className={btn} title="Run the agent again from scratch">
              <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden="true" /> Re-run
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="frame no-print mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SafetyToggles value={draft} onChange={setDraft} compact />
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              router.push(showHref({ id: props.id, name: props.id ? (state.podcast?.name ?? props.name ?? "") : (props.q ?? "") }, draft));
            }}
            className={`${btnPrimary} shrink-0`}
          >
            Apply and re-rank
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
        body: JSON.stringify({
          podcastId: state.podcast.id,
          brandId,
          name: props.id ? props.name ?? state.podcast.name : undefined,
          q: props.id ? undefined : props.q,
          x: props.exclude.join(","),
          fit,
        }),
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="deck-h" className="font-display text-[30px] leading-tight sm:text-[34px]">
            Ranked sponsors
          </h2>
          <p className="mt-1 text-sm text-muted">Fit scores are relative rankings within this deck, not revenue predictions.</p>
        </div>
        {state.filteredOut && state.filteredOut.length > 0 && (
          <span className="text-[13px] text-muted" title={state.filteredOut.map((f) => `${f.name} (${f.category})`).join(", ")}>
            <ShieldCheck className="mr-1 inline size-3.5" strokeWidth={1.75} aria-hidden="true" />
            {state.filteredOut.length} brand{state.filteredOut.length === 1 ? "" : "s"} removed by brand safety
          </span>
        )}
      </div>
      {err && <p role="alert" className="mb-3 border border-accent bg-accent-wash px-3 py-2 text-sm text-accent-text">{err}</p>}
      {!deck ? (
        running ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="frame p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="skeleton size-12" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-40" />
                    <div className="skeleton h-3 w-24" />
                  </div>
                  <div className="skeleton h-[84px] w-[84px]" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="skeleton h-7 w-28" />
                  <div className="skeleton h-7 w-32" />
                  <div className="skeleton h-7 w-24" />
                </div>
              </div>
            ))}
            <p className="text-center text-label text-muted">The agent is mapping tastes. Cards appear as soon as scoring finishes.</p>
          </div>
        ) : null
      ) : deck.length === 0 ? (
        <p className="frame p-5 text-sm text-fg-2">No brands could be ranked for this show. Try removing some brand-safety exclusions.</p>
      ) : (
        <div className="space-y-4">
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
    <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={back} className="inline-flex min-h-9 items-center gap-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-muted transition-colors duration-150 hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to deck
        </button>
        <div className="flex items-center gap-2">
          <ModePill mode={mode} />
          <button type="button" onClick={() => window.print()} disabled={state.status !== "done"} className={`${btnPrimary} disabled:opacity-50`}>
            <Printer className="size-4" strokeWidth={1.75} aria-hidden="true" /> Print or save as PDF
          </button>
        </div>
      </div>
      {mode === "sample" && (
        <p className="mb-4 border border-warn/40 bg-warn-wash px-3 py-2 text-[13px] font-medium text-warn-ink">Sample data: synthetic fixtures, not Qloo output.</p>
      )}
      <header className="flex items-center gap-4 border-b border-border-soft pb-5">
        {state.podcast && <EntityImage src={state.podcast.image} name={state.podcast.name} className="size-16 text-lg" />}
        <div>
          <p className="eyebrow">Audience media kit</p>
          <h1 className="mt-1 font-display text-[40px] leading-[1.05] tracking-[-0.04em]">{title}</h1>
          <div className="text-sm text-muted">
            {state.podcast?.genres?.join(", ")}
            {state.result ? `. Generated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(state.result.createdAt))}` : ""}
          </div>
        </div>
      </header>
      {state.summary && <p className="mt-5 text-[19px] leading-relaxed">{state.summary}</p>}
      <div className="mt-6">
        <AudienceSnapshot profile={state.profile} demographics={state.demographics} geography={state.geography} podcastName={state.podcast?.name} />
      </div>
      {deck.length > 0 && (
        <section className="frame print-avoid mt-6 p-5 sm:p-6">
          <h2 className="font-display text-[26px]">Brands our listeners already love</h2>
          <p className="text-sm text-muted">Ranked by HostRead fit (relative, not a revenue forecast).</p>
          <ol className="mt-4 divide-y divide-border-soft">
            {deck.slice(0, 6).map((c) => (
              <li key={c.brand.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-5 font-mono text-label text-muted tabular">{c.rank}</span>
                  <span className="font-semibold">{c.brand.name}</span>
                  <span className="text-label text-muted tabular">fit {c.fit}</span>
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
      <p className="mt-6 text-label text-muted">
        Taste data: Qloo taste graph via HostRead. Affinities describe aggregate audiences, not individuals. {state.status !== "done" ? "Loading…" : ""}
      </p>
    </main>
  );
}
