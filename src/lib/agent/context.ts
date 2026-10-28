// Run context shared by the agent loop, its tools and the guardrails.
import "server-only";
import type { TasteClient } from "../qloo/client";
import type { LlmClient } from "../llm/client";
import type {
  BaselineResult,
  BrandEntity,
  Demographics,
  DomainKey,
  DomainProfile,
  GeoPoint,
  OverlapResult,
  PodcastEntity,
  RunEvent,
  SafetyCategory,
  SponsorCard,
  TasteEntity,
  TraceStep,
} from "../types";

export interface RunState {
  podcast?: PodcastEntity;
  profile: Map<DomainKey, TasteEntity[]>;
  /** Candidates after brand-safety filtering, in Qloo affinity order. */
  candidates?: BrandEntity[];
  filteredOut: { name: string; category: SafetyCategory }[];
  brandProfiles: Map<string, DomainProfile[]>;
  overlaps: Map<string, OverlapResult>;
  demographics?: Demographics | null;
  geography?: GeoPoint[] | null;
  deck?: SponsorCard[];
  baselineNames?: Promise<string[] | null>;
  baseline?: BaselineResult;
  agentSummary?: string;
}

export interface RunContext {
  runId: string;
  qloo: TasteClient;
  llm: LlmClient;
  emit: (e: RunEvent) => void;
  signal: AbortSignal;
  exclude: SafetyCategory[];
  state: RunState;
  trace: TraceStep[];
  fallbacks: string[];
  startedAt: number;
  /** False once the LLM endpoint has failed hard; guardrails take over. */
  llmOk: boolean;
}

export function newState(): RunState {
  return { profile: new Map(), filteredOut: [], brandProfiles: new Map(), overlaps: new Map() };
}

let stepCounter = 0;

export interface StepMeta {
  actor: TraceStep["actor"];
  tool: string;
  title: string;
  params?: Record<string, unknown>;
  thought?: string;
}

export interface StepOutcome<T> {
  value: T;
  summary: string;
  counts?: Record<string, number>;
}

/** Run one traced step: emits running → ok/error with timing and API-call counts. */
export async function traced<T>(ctx: RunContext, meta: StepMeta, fn: () => Promise<StepOutcome<T>>): Promise<T> {
  const step: TraceStep = {
    id: `s${(stepCounter++).toString(36)}${Date.now().toString(36).slice(-3)}`,
    actor: meta.actor,
    tool: meta.tool,
    title: meta.title,
    params: meta.params,
    thought: meta.thought,
    status: "running",
    startedAt: Date.now() - ctx.startedAt,
  };
  ctx.trace.push(step);
  ctx.emit({ type: "step", step: { ...step } });
  const before = { api: ctx.qloo.stats.apiCalls, cached: ctx.qloo.stats.cachedCalls };
  const t0 = Date.now();
  try {
    const out = await fn();
    step.status = "ok";
    step.summary = out.summary;
    step.counts = out.counts;
    return out.value;
  } catch (err) {
    step.status = "error";
    step.summary = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    step.ms = Date.now() - t0;
    step.apiCalls = ctx.qloo.stats.apiCalls - before.api;
    step.cached = step.apiCalls === 0 && ctx.qloo.stats.cachedCalls > before.cached;
    ctx.emit({ type: "step", step: { ...step } });
  }
}

export function skippedStep(ctx: RunContext, meta: StepMeta, summary: string) {
  const step: TraceStep = { id: `s${(stepCounter++).toString(36)}`, ...meta, status: "skipped", startedAt: Date.now() - ctx.startedAt, ms: 0, summary };
  ctx.trace.push(step);
  ctx.emit({ type: "step", step });
}
