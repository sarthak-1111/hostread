"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Calculator,
  Check,
  ChevronDown,
  CircleCheck,
  FileDown,
  Link2,
  LoaderCircle,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Trophy,
  Users,
} from "lucide-react";
import { ModePill, SampleBanner, SiteFooter, SiteHeader } from "../chrome";
import { EntityImage, EvidenceChip } from "../domain";
import { HowWeScore } from "../HowWeScore";
import { SafetyToggles } from "../SafetyToggles";
import { showHref } from "../LaunchPanel";
import { TabList, TabPanel, type TabItem } from "../Tabs";
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
  /** Tab named in the link (?tab=), if any. */
  tab?: string;
  initialMode: "live" | "sample";
}

type TabKey = "sponsors" | "compare" | "audience" | "trace" | "scoring";
const TAB_KEYS: TabKey[] = ["sponsors", "compare", "audience", "trace", "scoring"];
const isTabKey = (v: unknown): v is TabKey => TAB_KEYS.includes(v as TabKey);

/** Sponsor cards shown before "Show more". */
const FIRST_CARDS = 3;

/** This page's address with the media-kit view switched on. */
function kitHref() {
  const u = new URL(window.location.href);
  u.searchParams.delete("tab");
  u.searchParams.set("view", "kit");
  return u.pathname + u.search;
}

function Pending({ text }: { text: string }) {
  return (
    <div className="frame flex items-center gap-2.5 p-5 text-[15px] text-fg-2">
      <LoaderCircle className="size-4 shrink-0 animate-spin text-muted" aria-hidden="true" /> {text}
    </div>
  );
}

/** One line under the header: what the agent is doing now, or how the deck was built. */
function RunStatus({ state, traceOpen, onTrace }: { state: RunUiState; traceOpen: boolean; onTrace: () => void }) {
  const running = state.status === "running" || state.status === "connecting";
  const current = [...state.steps].reverse().find((s) => s.status === "running") ?? state.steps.at(-1);
  const stats = state.result?.stats;
  const secs = stats ? Math.round(stats.ms / 1000) : 0;
  let text: string;
  if (state.status === "connecting") text = "Opening the deck…";
  else if (running) text = state.deck ? `Deck scored. ${current?.title ?? "Writing pitches"}…` : `The agent is working: ${current?.title ?? "starting"}`;
  else if (state.cached && state.result)
    text = `Opened from cache, no new API calls. Built ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(state.result.createdAt))} in ${secs} s from ${stats?.apiCalls ?? 0} Qloo calls.`;
  else text = `Built by the agent in ${secs} s: ${state.steps.length} steps, ${stats?.apiCalls ?? 0} Qloo calls, ${stats?.llmCalls ?? 0} LLM calls.`;
  const phase = state.status === "connecting" ? "" : running ? (state.deck ? "Deck ready. Writing pitches." : "The agent is working.") : "The deck is complete.";
  return (
    <div className="no-print mt-6 flex flex-col gap-3 border border-border-soft bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5 text-[14px] leading-snug sm:items-center">
        {running ? (
          <span className="on-air mt-1.5 size-2 shrink-0 rounded-full bg-accent sm:mt-0" aria-hidden="true" />
        ) : (
          <CircleCheck className="mt-px size-4 shrink-0 text-success-text sm:mt-0" aria-hidden="true" />
        )}
        <span className="min-w-0">{text}</span>
        <span className="sr-only" aria-live="polite">
          {phase}
        </span>
      </div>
      {!traceOpen && state.status !== "connecting" && (
        <button type="button" onClick={onTrace} className="btn btn-secondary btn-sm shrink-0 self-start sm:self-auto">
          <Bot className="size-3.5" strokeWidth={2} aria-hidden="true" /> {running ? "Watch the agent live" : "See how the agent built it"}
        </button>
      )}
    </div>
  );
}

/** The agent's summary, clamped to three lines so the first card stays near the top. */
function AgentRead({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 240;
  return (
    <div className="panel rise p-5 sm:p-6">
      <h2 className="eyebrow flex items-center gap-2">
        <Bot className="size-4" strokeWidth={2} aria-hidden="true" /> The agent&apos;s read on this audience
      </h2>
      <p id="agent-read" className={`mt-3 max-w-[62ch] text-[17px] leading-relaxed text-fg sm:text-[19px] ${long && !open ? "line-clamp-3" : ""}`}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="agent-read"
          className="mt-2 inline-flex min-h-9 items-center gap-1 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-muted transition-colors duration-150 hover:text-fg"
        >
          {open ? "Show less" : "Read all"}
          <ChevronDown className={`size-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const LEGEND: { tag: string; cls: string; text: string }[] = [
  { tag: "tool", cls: "", text: "A Qloo-backed tool the agent chose to call, with its stated reason." },
  { tag: "LLM", cls: "", text: "The model planning, or writing the summary and pitches." },
  { tag: "code", cls: "", text: "Deterministic steps: scoring and the grounding check. No model involved." },
  { tag: "guardrail", cls: "tag-warn", text: "The orchestrator stepping in: a limit, or finishing a plan the model left incomplete." },
];

function TraceLegend({ llm, fallbacks }: { llm?: string; fallbacks?: string[] }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start" aria-label="How to read the trace">
      <div className="frame p-5">
        <h2 className="font-display text-[19px] leading-snug">Reading the trace</h2>
        <dl className="mt-4 space-y-3 text-[14px]">
          {LEGEND.map((l) => (
            <div key={l.tag}>
              <dt>
                <span className={`tag ${l.cls}`}>{l.tag}</span>
              </dt>
              <dd className="mt-1 leading-snug text-fg-2">{l.text}</dd>
            </div>
          ))}
        </dl>
      </div>
      {llm && (
        <p className="px-1 text-label text-muted">
          Agent model: {llm}
          {fallbacks?.length ? `. Fallbacks: ${fallbacks.join(", ")}` : ""}
        </p>
      )}
    </aside>
  );
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
  const router = useRouter();
  const mode = state.mode ?? props.initialMode;
  const title = state.podcast?.name ?? props.name ?? props.q ?? "Podcast";
  const running = state.status === "running" || state.status === "connecting";

  // A fresh run opens on the live trace, and the deck takes over once it is scored,
  // unless the viewer picked a tab (or the link named one).
  const [picked, setPicked] = useState<TabKey | null>(isTabKey(props.tab) ? props.tab : null);
  const tab: TabKey = picked ?? (!state.deck && state.status === "running" && !state.cached ? "trace" : "sponsors");
  const pick = (k: TabKey) => {
    setPicked(k);
    const u = new URL(window.location.href);
    if (k === "sponsors") u.searchParams.delete("tab");
    else u.searchParams.set("tab", k);
    window.history.replaceState(window.history.state, "", u.pathname + u.search);
  };
  const tabs: TabItem<TabKey>[] = [
    { key: "sponsors", label: "Sponsors", Icon: Trophy, badge: state.deck?.length || undefined },
    { key: "compare", label: "Obvious vs. Surprising", short: "Surprises", Icon: Sparkles },
    { key: "audience", label: "Audience", Icon: Users },
    { key: "trace", label: "Agent trace", short: "Trace", Icon: Bot, live: running && !state.cached, badge: state.steps.length || undefined },
    { key: "scoring", label: "How we score", short: "Scoring", Icon: Calculator },
  ];

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

        {state.status !== "error" && <RunStatus state={state} traceOpen={tab === "trace"} onTrace={() => pick("trace")} />}

        <TabList id="deck" label="Deck sections" tabs={tabs} active={tab} onChange={pick} className="mt-6" />

        <TabPanel id="deck" k="sponsors" active={tab} className="pt-6">
          <Deck state={state} props={props} setPitch={setPitch} />
        </TabPanel>

        <TabPanel id="deck" k="compare" active={tab} className="pt-6">
          {state.deck || state.status === "done" ? (
            <ObviousVsSurprising baseline={state.baseline} deck={state.deck ?? []} />
          ) : (
            <Pending text="The comparison appears once the agent has scored the deck." />
          )}
        </TabPanel>

        <TabPanel id="deck" k="audience" active={tab} className="space-y-4 pt-6">
          {state.profile || running ? (
            <>
              <AudienceSnapshot profile={state.profile} demographics={state.demographics} geography={state.geography} podcastName={state.podcast?.name} />
              <div className="frame flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-[15px] text-fg-2">Attach it to a pitch: the same profile as a one-page media kit, ready to print or save as PDF.</p>
                <button type="button" disabled={state.status !== "done"} onClick={() => router.push(kitHref())} className={`${btn} shrink-0 disabled:opacity-50`}>
                  <FileDown className="size-4" strokeWidth={1.75} aria-hidden="true" /> Open media kit
                </button>
              </div>
            </>
          ) : (
            <Pending text="The audience profile appears once the agent has mapped the show's tastes." />
          )}
        </TabPanel>

        <TabPanel id="deck" k="trace" active={tab} className="pt-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <AgentTrace embedded steps={state.steps} running={running} cached={state.cached} stats={state.result?.stats} />
            <TraceLegend llm={state.llm} fallbacks={state.result?.stats.fallbacks} />
          </div>
        </TabPanel>

        <TabPanel id="deck" k="scoring" active={tab} className="pt-6">
          <HowWeScore />
        </TabPanel>
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

  const [showAll, setShowAll] = useState(false);
  const visible = deck ? (showAll ? deck : deck.slice(0, FIRST_CARDS)) : [];
  const hidden = deck ? deck.length - visible.length : 0;
  // Jump from the at-a-glance list to a card, revealing the rest of the deck if needed.
  const jumpTo = (rank: number) => {
    if (rank > FIRST_CARDS) setShowAll(true);
    requestAnimationFrame(() => {
      const el = document.getElementById(`sponsor-${rank}`);
      el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      el?.focus({ preventScroll: true });
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-labelledby="deck-h" className="min-w-0 space-y-4">
        {state.summary && <AgentRead text={state.summary} />}
        <h2 id="deck-h" className="sr-only">
          Ranked sponsors
        </h2>
        {err && <p role="alert" className="border border-accent bg-accent-wash px-3 py-2 text-sm text-accent-text">{err}</p>}
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
          <>
            {visible.map((card) => (
              <div key={card.brand.id} id={`sponsor-${card.rank}`} tabIndex={-1} className="scroll-mt-36 focus-visible:outline-none">
                <BrandCard
                  card={card}
                  pitch={state.pitches[card.brand.id]}
                  pitchPending={running && card.rank <= 3}
                  writing={!!writing[card.brand.id]}
                  onWritePitch={() => write(card.brand.id, card.fit)}
                />
              </div>
            ))}
            {deck.length > FIRST_CARDS && (
              <button type="button" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll} className="btn btn-secondary w-full">
                <ChevronDown className={`size-4 transition-transform duration-150 ${showAll ? "rotate-180" : ""}`} aria-hidden="true" />
                {showAll ? `Show the top ${FIRST_CARDS} only` : `Show ${hidden} more sponsor${hidden === 1 ? "" : "s"}`}
              </button>
            )}
          </>
        )}
      </section>

      <aside className="hidden lg:sticky lg:top-36 lg:block lg:self-start" aria-label="Ranking at a glance">
        <div className="frame p-5">
          <h2 className="font-display text-[19px] leading-snug">At a glance</h2>
          {deck?.length ? (
            <ol className="mt-3 divide-y divide-border-soft">
              {deck.map((c) => (
                <li key={c.brand.id}>
                  <button type="button" onClick={() => jumpTo(c.rank)} className="group flex w-full items-center gap-2.5 py-2 text-left">
                    <span className="w-5 shrink-0 font-mono text-label text-muted tabular">{c.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-medium group-hover:underline">{c.brand.name}</span>
                        {c.surpriseFit && <Sparkles className="size-3 shrink-0 text-accent-text" strokeWidth={2.25} aria-label="Surprise fit" />}
                      </span>
                      <span className="mt-1 block h-1 bg-accent-track" aria-hidden="true">
                        <span className="block h-full bg-accent" style={{ width: `${c.fit}%` }} />
                      </span>
                    </span>
                    <span className="w-7 shrink-0 text-right font-mono text-[13px] font-semibold tabular">{c.fit}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-3 space-y-2.5" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton h-6 w-full" />
              ))}
            </div>
          )}
          <p className="mt-3 border-t border-border-soft pt-3 text-label leading-relaxed text-muted">
            <Sparkles className="mr-1 inline size-3 text-accent-text" strokeWidth={2.25} aria-hidden="true" />
            Surprise fit: a plain LLM didn&apos;t suggest it. Fit is a relative ranking within this deck, not a revenue prediction.
          </p>
          {state.filteredOut && state.filteredOut.length > 0 && (
            <p className="mt-2 text-label text-muted" title={state.filteredOut.map((f) => `${f.name} (${f.category})`).join(", ")}>
              <ShieldCheck className="mr-1 inline size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {state.filteredOut.length} brand{state.filteredOut.length === 1 ? "" : "s"} removed by brand safety
            </p>
          )}
        </div>
      </aside>
    </div>
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
