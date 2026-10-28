"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, CircleCheck, CircleX, Code, Database, LoaderCircle, ShieldAlert, SkipForward } from "lucide-react";
import type { TraceStep } from "@/lib/types";

const ACTOR: Record<TraceStep["actor"], { label: string; cls: string; Icon: typeof Bot }> = {
  agent: { label: "tool", cls: "bg-accent-soft text-accent-ink", Icon: Database },
  llm: { label: "LLM", cls: "bg-violet-soft text-violet", Icon: Bot },
  code: { label: "code", cls: "bg-green-soft text-green", Icon: Code },
  guardrail: { label: "guardrail", cls: "bg-amber-soft text-amber", Icon: ShieldAlert },
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
  useEffect(() => {
    // Scroll only the trace list, never the page.
    const el = listRef.current;
    if (running && el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [steps.length, running]);

  const current = [...steps].reverse().find((s) => s.status === "running") ?? steps.at(-1);
  const apiCalls = stats?.apiCalls ?? steps.reduce((a, s) => a + (s.apiCalls ?? 0), 0);

  return (
    <section aria-label="Agent trace" className="rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpenMobile((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left lg:pointer-events-none"
        aria-expanded={openMobile}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {running ? <span className="on-air size-2 shrink-0 rounded-full bg-accent" /> : <CircleCheck className="size-4 shrink-0 text-green" />}
          <div className="min-w-0">
            <div className="text-sm font-semibold">Agent trace</div>
            <div className="truncate text-xs text-ink-3 lg:hidden">{running ? current?.title ?? "Starting…" : `${steps.length} steps`}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <span className="tabular">{steps.length} steps</span>
          <span>·</span>
          <span className="tabular">{apiCalls} API calls</span>
          {cached && <span className="rounded-full bg-green-soft px-2 py-0.5 font-medium text-green">cached</span>}
          <ChevronDown className={`size-4 transition lg:hidden ${openMobile ? "rotate-180" : ""}`} />
        </div>
      </button>
      <div className={`${openMobile ? "block" : "hidden"} border-t border-line lg:block`}>
        <ol ref={listRef} className="max-h-[60vh] overflow-y-auto px-2 py-2 lg:max-h-[calc(100dvh-220px)]">
          {steps.length === 0 && (
            <li className="flex items-center gap-2 px-2 py-3 text-sm text-ink-3">
              <LoaderCircle className="size-4 animate-spin" /> Connecting to the agent…
            </li>
          )}
          {steps.map((s) => {
            const A = ACTOR[s.actor];
            return (
              <li key={s.id} className="rise group rounded-xl px-2 py-2 hover:bg-surface-2">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0">
                    {s.status === "running" ? (
                      <LoaderCircle className="size-4 animate-spin text-accent" />
                    ) : s.status === "error" ? (
                      <CircleX className="size-4 text-accent-ink" />
                    ) : s.status === "skipped" ? (
                      <SkipForward className="size-4 text-amber" />
                    ) : (
                      <CircleCheck className="size-4 text-green" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[13.5px] font-medium leading-snug">{s.title}</div>
                      <div className="shrink-0 font-mono text-[11px] text-ink-3 tabular">{fmtMs(s.ms)}</div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10.5px] font-medium ${A.cls}`}>
                        <A.Icon className="size-3" aria-hidden="true" />
                        {A.label}
                      </span>
                      <span className="font-mono text-[11px] text-ink-2">{s.tool}</span>
                      {s.apiCalls ? <span className="font-mono text-[11px] text-ink-3">· {s.apiCalls} call{s.apiCalls === 1 ? "" : "s"}</span> : null}
                      {s.cached ? <span className="font-mono text-[11px] text-green">· cache</span> : null}
                    </div>
                    {s.thought && <p className="mt-1 text-xs italic leading-snug text-ink-2">“{s.thought}”</p>}
                    {s.params && Object.keys(s.params).length > 0 && (
                      <p className="mt-1 break-words font-mono text-[11px] leading-snug text-ink-3">{fmtParams(s.params)}</p>
                    )}
                    {s.summary && <p className={`mt-1 text-xs leading-snug ${s.status === "error" ? "text-accent-ink" : "text-ink-2"}`}>→ {s.summary}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {stats && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 font-mono text-[11px] text-ink-3">
            <span>{stats.apiCalls} Qloo calls</span>
            <span>{stats.llmCalls} LLM calls</span>
            <span>{fmtMs(stats.ms)} total</span>
          </div>
        )}
      </div>
    </section>
  );
}
