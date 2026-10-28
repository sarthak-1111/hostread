// The agent run: an LLM tool-calling loop over the taste-API tools, wrapped in
// guardrails (max steps, API-call budget, run timeout, retries, concurrency
// caps) and followed by grounded pitch writing.
import { config, dataMode, llmLabel } from "../config";
import { DOMAINS } from "../domains";
import { checkGrounding } from "../grounding";
import { LlmClient, LlmUnavailableError, type ChatMessage } from "../llm/client";
import { QlooError, TasteClient } from "../qloo/client";
import type { RunEvent, RunResult, SafetyCategory, TraceStep } from "../types";
import { baselineGuess } from "./baseline";
import { newState, skippedStep, traced, type RunContext } from "./context";
import { loadCandidates, loadDemographics, loadGeography, loadProfile, resolvePodcast, setPodcast } from "./stages";
import { TOOL_SPECS, runTool, toolRank } from "./tools";
import { stripEmphasis, writePitch } from "./writer";

export interface RunInput {
  podcastId?: string;
  nameHint?: string;
  query?: string;
  exclude: SafetyCategory[];
}

function systemPrompt(exclude: SafetyCategory[]): string {
  return [
    "You are HostRead's sponsorship research agent. Goal: find the brands this podcast's listeners already love that are strong sponsorship targets.",
    "You only know what the tools return. The tools are backed by the Qloo taste graph (cross-domain affinity data).",
    "",
    "Plan:",
    "1. audience_profile: what listeners love across film, tv, music, dining, books, travel and podcasts.",
    "2. brand_candidates: brands ranked by affinity among this show's listeners" + (exclude.length ? ` (excluded for brand safety: ${exclude.join(", ")})` : "") + ".",
    `3. Choose up to ${config.agent.deepDiveBrands} brands for brand_fan_profile. Favour high affinity but pick a varied set: at most 2 per category, skip near-duplicates or sub-brands of the same company, and skip brands that are implausible podcast sponsors (no consumer product, government or utilities).`,
    "4. overlap_evidence for the brands you profiled.",
    "5. demographics and geography for the media kit.",
    "6. rank_sponsors: deterministic scoring code. Never compute or adjust scores yourself.",
    "Then reply (without tools) with a 2–3 sentence read on what defines this audience's taste, citing only names the tools returned. Plain text, no em dashes.",
    "",
    "Rules: independent tool calls may go in the same turn. Use ids exactly as returned. Never invent entities, ids or numbers. Don't repeat a call with the same arguments. Give a short `reason` with each call.",
  ].join("\n");
}

export async function executeRun(input: RunInput, emit: (e: RunEvent) => void, signal: AbortSignal, runId: string): Promise<RunResult | null> {
  const ctx: RunContext = {
    runId,
    qloo: new TasteClient(config.agent.maxApiCalls),
    llm: new LlmClient(),
    emit,
    signal,
    exclude: input.exclude,
    state: newState(),
    trace: [],
    fallbacks: [],
    startedAt: Date.now(),
    llmOk: true,
  };
  emit({ type: "meta", mode: dataMode(), llm: llmLabel(), runId, cached: false });

  try {
    // ---- 1. resolve the show (code if the user picked one from autocomplete)
    if (input.podcastId) {
      const p = await traced(ctx, { actor: "code", tool: "resolve_podcast", title: "Load the selected show", params: { id: input.podcastId } }, async () => {
        const v = await ctx.qloo.getPodcast(input.podcastId!, input.nameHint);
        return { value: v, summary: v ? v.name : "Not found" };
      });
      if (!p) {
        emit({ type: "error", message: "We couldn't find that show in the taste graph. Try searching for it by name.", code: "NOT_FOUND" });
        return null;
      }
      setPodcast(ctx, p);
      startBaseline(ctx);
    }

    // ---- 2. the agent loop
    await agentLoop(ctx, input);

    // ---- 3. guardrails: finish anything the agent skipped
    await ensureComplete(ctx, input);
    if (!ctx.state.podcast) {
      emit({ type: "error", message: `No podcast matched “${input.query ?? input.nameHint ?? ""}”. Try another spelling or pick a show from the suggestions.`, code: "NOT_FOUND" });
      return null;
    }

    // ---- 4. summary (grounded) + pitches for the top cards
    finishSummary(ctx);
    await writeTopPitches(ctx);

    const s = ctx.state;
    const result: RunResult = {
      runId,
      mode: ctx.qloo.mode,
      llm: llmLabel(),
      createdAt: new Date().toISOString(),
      podcast: s.podcast!,
      profile: [...s.profile.entries()].map(([domain, entities]) => ({ domain, entities })),
      demographics: s.demographics ?? null,
      geography: s.geography ?? null,
      deck: s.deck ?? [],
      baseline: s.baseline ?? { available: false, picks: [] },
      excluded: ctx.exclude,
      filteredOut: s.filteredOut,
      agentSummary: s.agentSummary,
      stats: {
        apiCalls: ctx.qloo.stats.apiCalls,
        llmCalls: ctx.llm.stats.calls,
        llmTokens: ctx.llm.stats.promptTokens + ctx.llm.stats.completionTokens,
        ms: Date.now() - ctx.startedAt,
        steps: ctx.trace.length,
        fallbacks: ctx.fallbacks,
      },
      trace: ctx.trace.map((t): TraceStep => ({ ...t })),
    };
    emit({ type: "done", result });
    return result;
  } catch (err) {
    if (signal.aborted) return null;
    const message =
      err instanceof QlooError
        ? err.code === "QLOO_AUTH"
          ? "The taste API key isn't working right now. The examples on the home page are cached and still work."
          : err.message
        : "Something went wrong while building the deck. Please try again.";
    emit({ type: "error", message, code: err instanceof QlooError ? err.code : "RUN_FAILED" });
    console.error("[run] failed", err instanceof Error ? err.message : err);
    return null;
  }
}

function startBaseline(ctx: RunContext) {
  const p = ctx.state.podcast;
  if (!p || ctx.state.baselineNames) return;
  ctx.state.baselineNames = traced(
    ctx,
    { actor: "llm", tool: "baseline_guess", title: "Plain-LLM sponsor guess (no taste data)", params: { input: "show name + topic only" } },
    async () => {
      const names = await baselineGuess(ctx.llm, p, ctx.signal);
      return { value: names, summary: names.length ? `${names.length} brands guessed` : "No usable answer", counts: { brands: names.length } };
    },
  ).catch(() => {
    ctx.fallbacks.push("baseline-unavailable");
    return null;
  });
}

async function agentLoop(ctx: RunContext, input: RunInput) {
  const p = ctx.state.podcast;
  const task = p
    ? `Podcast: "${p.name}" (id: ${p.id}${p.genres?.length ? `, genres: ${p.genres.join(", ")}` : ""}). It is already resolved. Start with audience_profile and brand_candidates.`
    : `The user typed: "${input.query ?? input.nameHint ?? ""}". Call resolve_podcast first.`;
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(ctx.exclude) },
    { role: "user", content: task },
  ];
  let ranked = false;
  for (let i = 0; i < config.agent.maxSteps; i++) {
    if (ctx.signal.aborted) return;
    if (Date.now() - ctx.startedAt > config.agent.runTimeoutMs * 0.6) {
      ctx.fallbacks.push("agent-time-budget");
      skippedStep(ctx, { actor: "guardrail", tool: "time_budget", title: "Time budget reached, guardrails finish the run" }, "Remaining steps run without the LLM");
      return;
    }
    const t0 = Date.now();
    let res;
    try {
      res = await ctx.llm.chat({ messages, tools: ranked ? undefined : TOOL_SPECS, temperature: 0.2, maxTokens: 2500, signal: ctx.signal });
    } catch (err) {
      if (ctx.signal.aborted) return;
      ctx.llmOk = false;
      ctx.fallbacks.push("llm-unavailable");
      skippedStep(
        ctx,
        { actor: "guardrail", tool: "llm", title: "LLM unavailable, switching to the scripted plan" },
        err instanceof LlmUnavailableError ? err.message : "Language model error",
      );
      return;
    }
    const planStep: TraceStep = {
      id: `llm${i}${Date.now().toString(36).slice(-4)}`,
      actor: "llm",
      tool: "agent",
      title: res.toolCalls.length ? `Agent chose: ${[...new Set(res.toolCalls.map((t) => t.name))].join(", ")}` : "Agent wrote its summary",
      status: "ok",
      startedAt: t0 - ctx.startedAt,
      ms: Date.now() - t0,
      summary: res.viaText ? "tool calls parsed from text (fallback mode)" : undefined,
    };
    ctx.trace.push(planStep);
    ctx.emit({ type: "step", step: planStep });
    if (res.viaText && !ctx.fallbacks.includes("text-tool-mode")) ctx.fallbacks.push("text-tool-mode");

    if (!res.toolCalls.length) {
      if (res.content.trim()) ctx.state.agentSummary = res.content.trim();
      if (ranked) return;
      // The model stopped before ranking: nudge once, then let guardrails finish.
      if (i > 0 && messages.at(-1)?.role === "user") return;
      messages.push({ role: "assistant", content: res.content || "" });
      messages.push({ role: "user", content: "Continue with the plan using the tools. Finish with rank_sponsors." });
      continue;
    }
    messages.push({ role: "assistant", content: res.content || null, tool_calls: res.toolCalls });
    let stop = false;
    for (const call of res.toolCalls.slice(0, 6)) {
      if (ctx.signal.aborted) return;
      const out = await runTool(ctx, call.name, call.args);
      if (out.ranked) ranked = true;
      if (out.content.includes('"stop":true')) stop = true;
      if (call.name === "resolve_podcast" && ctx.state.podcast) startBaseline(ctx);
      messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: out.content });
    }
    if (stop) {
      ctx.fallbacks.push("api-budget");
      return;
    }
  }
}

async function ensureComplete(ctx: RunContext, input: RunInput) {
  const s = ctx.state;
  const g = (tool: string, title: string, params?: Record<string, unknown>) => ({ actor: "guardrail" as const, tool, title, params });
  if (!s.podcast) {
    const q = input.query ?? input.nameHint;
    if (!q) return;
    const hits = await traced(ctx, g("resolve_podcast", `Search the taste graph for “${q}”`, { query: q }), async () => {
      const r = await resolvePodcast(ctx, q);
      return { value: r, summary: r.length ? `best: ${r[0].name}` : "No matches" };
    });
    if (!hits.length) return;
    setPodcast(ctx, hits.find((h) => h.name.toLowerCase() === q.toLowerCase()) ?? hits[0]);
    startBaseline(ctx);
  }
  const missingDomains = (["film", "tv", "music", "dining", "books", "travel", "podcasts"] as const).filter((d) => !s.profile.has(d));
  if (missingDomains.length) {
    await traced(ctx, g("audience_profile", "Map what listeners love across domains", { domains: missingDomains }), async () => {
      await loadProfile(ctx, [...missingDomains]);
      return { value: null, summary: missingDomains.map((d) => `${s.profile.get(d)?.length ?? 0} ${DOMAINS[d].label}`).join(", ") };
    });
  }
  if (!s.candidates) {
    await traced(ctx, g("brand_candidates", "Rank brands by listener affinity", { take: 50, exclude: ctx.exclude }), async () => {
      const k = await loadCandidates(ctx);
      return { value: null, summary: `${k.length} brands` };
    });
  }
  if (s.demographics === undefined) {
    await traced(ctx, g("demographics", "Audience age & gender skew"), async () => {
      const d = await loadDemographics(ctx);
      return { value: null, summary: d ? "loaded" : "not available" };
    });
  }
  if (s.geography === undefined) {
    await traced(ctx, g("geography", "Where the audience over-indexes"), async () => {
      const v = await loadGeography(ctx);
      return { value: null, summary: v?.length ? `Top: ${v.slice(0, 3).map((x) => x.name).join(", ")}` : "not available" };
    });
  }
  if (!s.deck) await toolRank(ctx, "guardrail");
}

function finishSummary(ctx: RunContext) {
  const s = ctx.state;
  const deck = s.deck ?? [];
  if (s.agentSummary) {
    const allowed = [
      ...[...s.profile.values()].flatMap((l) => l.map((e) => e.name)),
      ...(s.candidates ?? []).map((b) => b.name),
      ...(s.geography ?? []).map((g) => g.name),
    ];
    const always = [s.podcast?.name ?? "", ...(s.podcast?.genres ?? []), ...(s.candidates ?? []).map((b) => b.category ?? "")].filter(Boolean);
    const g = checkGrounding(s.agentSummary, allowed, always);
    if (!g.ok) {
      ctx.fallbacks.push("summary-regrounded");
      s.agentSummary = undefined;
    }
  }
  if (!s.agentSummary && s.podcast) {
    const pick = (d: "film" | "music" | "books" | "tv") => s.profile.get(d)?.[0]?.name;
    const loves = [pick("film"), pick("music"), pick("books") ?? pick("tv")].filter(Boolean) as string[];
    const top = deck[0];
    const surprises = deck.filter((c) => c.surpriseFit).length;
    s.agentSummary =
      (loves.length ? `${s.podcast.name} listeners over-index on ${loves.join(", ")}. ` : "") +
      (top ? `The strongest sponsor fit is ${top.brand.name} (fit ${top.fit})` : "") +
      (surprises ? `, and ${surprises} of the ${deck.length} picks are surprise fits a plain LLM didn't suggest.` : ".");
  }
  if (s.agentSummary) {
    s.agentSummary = stripEmphasis(s.agentSummary).replace(/\s+/g, " ").trim();
    ctx.emit({ type: "summary", text: s.agentSummary });
  }
}

async function writeTopPitches(ctx: RunContext) {
  const s = ctx.state;
  const top = (s.deck ?? []).slice(0, config.agent.pitchesUpFront);
  for (const card of top) {
    if (ctx.signal.aborted) return;
    const overTime = Date.now() - ctx.startedAt > config.agent.runTimeoutMs * 0.85;
    const useLlm = ctx.llmOk && !overTime;
    const pitch = await traced(
      ctx,
      { actor: useLlm ? "llm" : "code", tool: "write_pitch", title: `Write pitch email + ad script for ${card.brand.name}`, params: { grounding: "only entities returned in this run" } },
      async () => {
        const v = await writePitch(useLlm ? ctx.llm : null, { podcast: s.podcast!, card, profile: s.profile, demographics: s.demographics, geography: s.geography }, ctx.signal);
        const note =
          v.source === "llm"
            ? `${v.adWords}-word script (~${v.adSeconds}s), ${v.references.length} grounded references${v.rejected?.length ? `; rewrote to drop ${v.rejected.length} invented` : ""}`
            : `template fallback${v.rejected?.length ? ` after ${v.rejected.length} invented references` : ""}`;
        return { value: v, summary: note, counts: { references: v.references.length } };
      },
    );
    card.pitch = pitch;
    ctx.emit({ type: "pitch", brandId: card.brand.id, pitch });
  }
}
