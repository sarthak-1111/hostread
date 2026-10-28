"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, CircleCheck, CircleX, Code, Database, LoaderCircle, ShieldAlert, SkipForward } from "lucide-react";
import type { TraceStep } from "@/lib/types";

const ACTOR: Record<TraceStep["actor"], { label: string; cls: string; Icon: typeof Bot }> = {
  agent: { label: "tool", cls: "bg-bg text-fg-2 shadow-[0_0_0_1px_var(--border-soft)]", Icon: Database },
  llm: { label: "LLM", cls: "bg-bg text-fg-2 shadow-[0_0_0_1px_var(--border-soft)]", Icon: Bot },
  code: { label: "code", cls: "bg-bg text-fg-2 shadow-[0_0_0_1px_var(--border-soft)]", Icon: Code },
  guardrail: { label: "guardrail", cls: "bg-warn-wash text-warn-ink", Icon: ShieldAlert },
};

function fmtMs(ms?: number) {
  if (ms === undefined) return "";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function fmtParams(p?: Record<string, unknown>) {
  if (!p) return "";
  return Object.entries(p)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? (v.length > 4 ? `[${v.slice(0, 4).join(", ")}, +${v.length - 4}]` : `[${v.join(", ")}]`) : String(v)}`)
    .join("  ");
}

export function AgentTrace({ steps, running, cached, stats }: { steps: TraceStep[]; running: boolean; cached: boolean; stats?: { apiCalls: number; llmCalls: number; ms: number } }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [openMobile, setOpenMobile] = useState(false);
  // On wide screens the list is always open, so the toggle is not a tab stop.
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    // Scroll only the trace list, never the page.
    const el = listRef.current;
    if (running && el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [steps.length, running]);

  const current = [...steps].reverse().find((s) => s.status === "running") ?? steps.at(-1);
  const apiCalls = stats?.apiCalls ?? steps.reduce((a, s) => a + (s.apiCalls ?? 0), 0);

  return (
    <section aria-label="Agent trace" className="rounded-lg bg-surface shadow-[0_0_0_1px_var(--border-soft)]">
      <button
        type="button"
        onClick={() => setOpenMobile((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left lg:pointer-events-none"
        tabIndex={desktop ? -1 : undefined}
        aria-expanded={openMobile}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {running ? (
            <span className="on-air size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          ) : (
            <CircleCheck className="size-4 shrink-0 text-success-text" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <div className="whitespace-nowrap font-display text-[19px] leading-tight">Agent trace</div>
            <div className="truncate text-label text-muted lg:hidden" aria-live="polite">
              {running ? (current?.title ?? "Starting…") : `${steps.length} steps`}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-label text-muted">
          <span className="tabular">{apiCalls} API calls</span>
          {cached && <span className="rounded-full bg-success-wash px-2 py-0.5 font-medium text-success-text">Cached</span>}
          <ChevronDown className={`size-4 transition-transform duration-150 lg:hidden ${openMobile ? "rotate-180" : ""}`} aria-hidden="true" />
        </div>
      </button>
      <div className={`${openMobile ? "block" : "hidden"} border-t border-border-soft lg:block`}>
        <ol ref={listRef} className="max-h-[60vh] overflow-y-auto overscroll-contain px-2 py-2 lg:max-h-[calc(100dvh-240px)]">
          {steps.length === 0 && (
            <li className="flex items-center gap-2 px-2 py-3 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Connecting to the agent…
            </li>
          )}
          {steps.map((s) => {
            const A = ACTOR[s.actor];
            return (
              <li key={s.id} className="rise rounded-sm px-2 py-2.5 transition-colors duration-150 hover:bg-bg">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0">
                    {s.status === "running" ? (
                      <LoaderCircle className="size-4 animate-spin text-accent" aria-label="Running" />
                    ) : s.status === "error" ? (
                      <CircleX className="size-4 text-danger-text" aria-label="Failed" />
                    ) : s.status === "skipped" ? (
                      <SkipForward className="size-4 text-warn-ink" aria-label="Skipped" />
                    ) : (
                      <CircleCheck className="size-4 text-success-text" aria-label="Done" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[14px] font-medium leading-snug">{s.title}</div>
                      <div className="shrink-0 text-label text-muted tabular">{fmtMs(s.ms)}</div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-label font-medium ${A.cls}`}>
                        <A.Icon className="size-3" strokeWidth={1.75} aria-hidden="true" />
                        {A.label}
                      </span>
                      <span className="font-mono text-label text-fg-2" translate="no">
                        {s.tool}
                      </span>
                      {s.apiCalls ? (
                        <span className="text-label text-muted">
                          {s.apiCalls} call{s.apiCalls === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {s.cached ? <span className="text-label text-success-text">from cache</span> : null}
                    </div>
                    {s.thought && <p className="mt-1.5 text-[13px] italic leading-snug text-fg-2">“{s.thought}”</p>}
                    {s.params && Object.keys(s.params).length > 0 && (
                      <p className="mt-1 break-words font-mono text-label leading-snug text-muted">{fmtParams(s.params)}</p>
                    )}
                    {s.summary && <p className={`mt-1 text-[13px] leading-snug ${s.status === "error" ? "text-danger-text" : "text-fg-2"}`}>→ {s.summary}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {stats && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border-soft px-4 py-3 text-label text-muted tabular">
            <span>{stats.apiCalls} Qloo calls</span>
            <span>{stats.llmCalls} LLM calls</span>
            <span>{fmtMs(stats.ms)} total</span>
          </div>
        )}
      </div>
    </section>
  );
}
