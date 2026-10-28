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

export function useRun(query: string | null) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!query || started.current === query) return;
    started.current = query;
    dispatch({ type: "reset" });
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/run?${query}`, { signal: ctrl.signal, headers: { Accept: "text/event-stream" } });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let finished = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              try {
                const ev = JSON.parse(line.slice(6)) as RunEvent;
                if (ev.type === "done" || ev.type === "error") finished = true;
                dispatch({ type: "event", e: ev });
              } catch {
                /* ignore malformed frame */
              }
            }
          }
        }
        if (!finished) dispatch({ type: "net-error", message: "The connection closed before the deck was finished. Reload to pick up the cached result." });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        dispatch({ type: "net-error", message: err instanceof Error && err.message.startsWith("HTTP") ? "The server couldn't start the analysis." : "Network error — check your connection and retry." });
      }
    })();
    return () => {
      ctrl.abort();
      started.current = null;
    };
  }, [query]);

  return { state, setPitch: (brandId: string, pitch: PitchPack) => dispatch({ type: "pitch", brandId, pitch }) };
}
