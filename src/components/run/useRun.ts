"use client";

import { useEffect, useReducer, useRef } from "react";
import type { BaselineResult, Demographics, DomainProfile, GeoPoint, PitchPack, PodcastEntity, RunEvent, RunResult, SponsorCard, TraceStep } from "@/lib/types";

export interface RunUiState {
  status: "connecting" | "running" | "done" | "error";
  cached: boolean;
  mode?: "live" | "sample";
  llm?: string;
  steps: TraceStep[];
  podcast?: PodcastEntity;
  profile?: DomainProfile[];
  demographics?: Demographics | null;
  geography?: GeoPoint[] | null;
  candidates?: number;
  deck?: SponsorCard[];
  filteredOut?: RunResult["filteredOut"];
  baseline?: BaselineResult;
  pitches: Record<string, PitchPack>;
  summary?: string;
  result?: RunResult;
  error?: { message: string; code?: string };
  startedAt: number;
}

type Action = { type: "event"; e: RunEvent } | { type: "reset" } | { type: "net-error"; message: string } | { type: "pitch"; brandId: string; pitch: PitchPack };

const initial = (): RunUiState => ({ status: "connecting", cached: false, steps: [], pitches: {}, startedAt: Date.now() });

function upsertStep(steps: TraceStep[], s: TraceStep): TraceStep[] {
  const i = steps.findIndex((x) => x.id === s.id);
  if (i === -1) return [...steps, s];
  const next = steps.slice();
  next[i] = s;
  return next;
}

function reducer(state: RunUiState, a: Action): RunUiState {
  if (a.type === "reset") return initial();
  if (a.type === "net-error") return state.status === "done" ? state : { ...state, status: "error", error: { message: a.message, code: "NETWORK" } };
  if (a.type === "pitch") return { ...state, pitches: { ...state.pitches, [a.brandId]: a.pitch } };
  const e = a.e;
  switch (e.type) {
    case "meta":
      return { ...state, status: "running", cached: e.cached, mode: e.mode, llm: e.llm };
    case "step":
      return { ...state, steps: upsertStep(state.steps, e.step) };
    case "podcast":
      return { ...state, podcast: e.podcast };
    case "profile":
      return { ...state, profile: e.profile };
    case "demographics":
      return { ...state, demographics: e.demographics };
    case "geography":
      return { ...state, geography: e.geography };
    case "candidates":
      return { ...state, candidates: e.count };
    case "deck":
      return { ...state, deck: e.deck, filteredOut: e.filteredOut };
    case "baseline":
      return { ...state, baseline: e.baseline };
    case "pitch":
      return { ...state, pitches: { ...state.pitches, [e.brandId]: e.pitch } };
    case "summary":
      return { ...state, summary: e.text };
    case "done": {
      const r = e.result;
      const pitches: Record<string, PitchPack> = { ...state.pitches };
      for (const c of r.deck) if (c.pitch) pitches[c.brand.id] = c.pitch;
      return {
        ...state,
        status: "done",
        mode: r.mode,
        llm: r.llm,
        steps: state.steps.length >= r.trace.length ? state.steps : r.trace,
        podcast: r.podcast,
        profile: r.profile,
        demographics: r.demographics,
        geography: r.geography,
        deck: r.deck,
        filteredOut: r.filteredOut,
        baseline: r.baseline,
        summary: r.agentSummary,
        pitches,
        result: r,
      };
    }
    case "error":
      return { ...state, status: "error", error: { message: e.message, code: e.code } };
  }
  return state;
}

interface StartResponse {
  cached?: boolean;
  result?: RunResult;
  jobId?: string;
  pollMs?: number;
  error?: string;
  code?: string;
}

interface PollResponse {
  found: boolean;
  events: RunEvent[];
  next: number;
  done: boolean;
  stale?: boolean;
}

class PollError extends Error {}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/** Poll a job's event log until it finishes. */
async function poll(jobId: string, pollMs: number, signal: AbortSignal, emit: (e: RunEvent) => void) {
  let from = 0;
  let misses = 0;
  let failures = 0;
  while (!signal.aborted) {
    let body: PollResponse;
    try {
      const res = await fetch(`/api/run/events?job=${jobId}&from=${from}`, { signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = (await res.json()) as PollResponse;
      failures = 0;
    } catch (err) {
      if (signal.aborted) return;
      // Ride out brief network blips; give up after ~15 s of failures.
      if (++failures > 10) throw err;
      await sleep(1500, signal);
      continue;
    }
    for (const e of body.events) {
      emit(e);
      if (e.type === "done" || e.type === "error") return;
    }
    from = body.next;
    if (body.done) throw new PollError("The analysis ended without a result. Please re-run it.");
    if (body.stale) throw new PollError("The analysis stopped responding. Please re-run it.");
    if (!body.found && ++misses > 30) throw new PollError("The analysis didn't start. Please try again.");
    await sleep(pollMs, signal);
  }
}

export function useRun(query: string | null) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!query || started.current === query) return;
    started.current = query;
    dispatch({ type: "reset" });
    const ctrl = new AbortController();
    const { signal } = ctrl;
    const emit = (e: RunEvent) => {
      if (!signal.aborted) dispatch({ type: "event", e });
    };
    (async () => {
      try {
        const res = await fetch(`/api/run?${query}`, { method: "POST", signal, cache: "no-store" });
        const start = (await res.json().catch(() => ({}))) as StartResponse;
        if (start.error || !res.ok) {
          emit({ type: "error", message: start.error ?? "The server couldn't start the analysis.", code: start.code });
          return;
        }
        if (start.cached && start.result) {
          // Replay the cached trace quickly so the run still reads as a story.
          const r = start.result;
          emit({ type: "meta", mode: r.mode, llm: r.llm, runId: r.runId, cached: true });
          for (const step of r.trace) {
            emit({ type: "step", step });
            await sleep(18, signal);
          }
          emit({ type: "done", result: r });
          return;
        }
        if (!start.jobId) throw new Error("no job");
        await poll(start.jobId, start.pollMs ?? 1000, signal, emit);
      } catch (err) {
        if (signal.aborted) return;
        dispatch({ type: "net-error", message: err instanceof PollError ? err.message : "Network error. Check your connection and retry." });
      }
    })();
    return () => {
      ctrl.abort();
      started.current = null;
    };
  }, [query]);

  return { state, setPitch: (brandId: string, pitch: PitchPack) => dispatch({ type: "pitch", brandId, pitch }) };
}
