// Agent tools. Each wraps the taste API (through TasteClient) or deterministic
// code, records a trace step, and returns a COMPACT JSON summary to the LLM —
// the full data stays server-side in the run state.
import { z } from "zod";
import { config } from "../config";
import { DOMAINS, OVERLAP_DOMAINS, PROFILE_DOMAINS } from "../domains";
import type { ToolSpec } from "../llm/client";
import type { DomainKey } from "../types";
import { traced, type RunContext } from "./context";
import {
  computeOverlaps,
  defaultDeepDive,
  loadCandidates,
  loadDemographics,
  loadFanProfiles,
  loadGeography,
  loadProfile,
  matchCandidates,
  rank,
  resolvePodcast,
  setPodcast,
} from "./stages";

const domainEnum = z.enum(["film", "tv", "music", "dining", "books", "travel", "podcasts"]);

const schemas = {
  resolve_podcast: z.object({ query: z.string().min(1).max(120).optional(), select_id: z.string().max(120).optional(), reason: z.string().max(300).optional() }),
  audience_profile: z.object({ domains: z.array(domainEnum).max(7).optional(), reason: z.string().max(300).optional() }),
  brand_candidates: z.object({ take: z.number().int().optional(), reason: z.string().max(300).optional() }),
  brand_fan_profile: z.object({ brand_ids: z.array(z.string().max(160)).min(1).max(10), domains: z.array(domainEnum).max(5).optional(), reason: z.string().max(400).optional() }),
  overlap_evidence: z.object({ brand_ids: z.array(z.string().max(160)).max(10).optional(), reason: z.string().max(300).optional() }),
  demographics: z.object({ reason: z.string().max(300).optional() }),
  geography: z.object({ reason: z.string().max(300).optional() }),
  rank_sponsors: z.object({ reason: z.string().max(300).optional() }),
} as const;

export type ToolName = keyof typeof schemas;

const reasonProp = { reason: { type: "string", description: "One short sentence: why you are calling this tool now." } };

export const TOOL_SPECS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "resolve_podcast",
      description: "Find the podcast in the Qloo taste graph. Pass `query` (show name) to search, or `select_id` to pick one of the returned candidates.",
      parameters: { type: "object", properties: { query: { type: "string" }, select_id: { type: "string" }, ...reasonProp } },
    },
  },
  {
    type: "function",
    function: {
      name: "audience_profile",
      description: "What this podcast's listeners love across domains (Qloo affinity): film, tv, music, dining, books, travel, podcasts. Returns the top names per domain.",
      parameters: { type: "object", properties: { domains: { type: "array", items: { type: "string", enum: PROFILE_DOMAINS } }, ...reasonProp } },
    },
  },
  {
    type: "function",
    function: {
      name: "brand_candidates",
      description: "Brands ranked by affinity among this podcast's listeners (Qloo). Brand-safety exclusions chosen by the user are applied automatically.",
      parameters: { type: "object", properties: { ...reasonProp } },
    },
  },
  {
    type: "function",
    function: {
      name: "brand_fan_profile",
      description: `How much each brand's fans like the listeners' top favourites in film, tv, music, books and food & drink (Qloo affinity for the same items). Call for the brands you want to investigate (max ${config.agent.deepDiveBrands} per run). Use brand ids exactly as returned by brand_candidates.`,
      parameters: {
        type: "object",
        properties: { brand_ids: { type: "array", items: { type: "string" }, maxItems: 10 }, ...reasonProp },
        required: ["brand_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "overlap_evidence",
      description: "Deterministic code: compare listener taste with each investigated brand's fan taste (weighted Jaccard per domain) and return the shared favourites as evidence.",
      parameters: { type: "object", properties: { brand_ids: { type: "array", items: { type: "string" } }, ...reasonProp } },
    },
  },
  {
    type: "function",
    function: { name: "demographics", description: "Age and gender skew of this podcast's audience (Qloo), for the media kit.", parameters: { type: "object", properties: { ...reasonProp } } },
  },
  {
    type: "function",
    function: { name: "geography", description: "Where this podcast's audience over-indexes geographically (Qloo heatmap), if available.", parameters: { type: "object", properties: { ...reasonProp } } },
  },
  {
    type: "function",
    function: {
      name: "rank_sponsors",
      description: "Deterministic scoring code: Fit = 100 × (0.50·audience affinity + 0.35·taste overlap + 0.15·surprise vs a plain-LLM guess). Call once after overlap_evidence. Never compute scores yourself.",
      parameters: { type: "object", properties: { ...reasonProp } },
    },
  },
];

export interface ToolResult {
  content: string;
  /** Set when this call produced the final ranking. */
  ranked?: boolean;
}

const names = (xs: { name: string }[], n = 5) => xs.slice(0, n).map((x) => x.name);

export async function runTool(ctx: RunContext, name: string, rawArgs: Record<string, unknown>): Promise<ToolResult> {
  const schema = (schemas as Record<string, z.ZodTypeAny>)[name];
  if (!schema) return { content: JSON.stringify({ error: `Unknown tool ${name}` }) };
  const parsed = schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { content: JSON.stringify({ error: "Invalid arguments", details: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) }) };
  }
  const args = parsed.data as Record<string, unknown> & { reason?: string };
  // The model's stated reason, minus the zero-width characters gpt-oss sometimes emits.
  const thought = typeof args.reason === "string" ? args.reason.replace(/[​-‍⁠﻿]/g, "").replace(/\s+/g, " ").trim() || undefined : undefined;
  const params = Object.fromEntries(Object.entries(args).filter(([k]) => k !== "reason"));

  try {
    switch (name as ToolName) {
      case "resolve_podcast":
        return await toolResolve(ctx, params as { query?: string; select_id?: string }, thought);
      case "audience_profile":
        return await toolProfile(ctx, (params.domains as DomainKey[] | undefined) ?? PROFILE_DOMAINS, thought);
      case "brand_candidates":
        // Always fetch the full pool (50): the LLM sees the top 25, percentiles need the rest.
        return await toolCandidates(ctx, 50, thought);
      case "brand_fan_profile":
        // Every brand is compared on the same domains so overlap scores stay comparable.
        return await toolFanProfile(ctx, params.brand_ids as string[], OVERLAP_DOMAINS, thought);
      case "overlap_evidence":
        return await toolOverlap(ctx, params.brand_ids as string[] | undefined, thought);
      case "demographics":
        return await toolDemographics(ctx, thought);
      case "geography":
        return await toolGeography(ctx, thought);
      case "rank_sponsors":
        return await toolRank(ctx, "agent", thought);
    }
  } catch (err) {
    const e = err as Error;
    return { content: JSON.stringify({ error: e.message, stop: e.name === "BudgetExceededError" }) };
  }
  return { content: JSON.stringify({ error: "unreachable" }) };
}

async function toolResolve(ctx: RunContext, p: { query?: string; select_id?: string }, thought?: string): Promise<ToolResult> {
  if (p.select_id) {
    const chosen = ctx.state.podcastCandidates?.find((c) => c.id === p.select_id);
    if (!chosen) return { content: JSON.stringify({ error: "select_id must be one of the ids returned by the last resolve_podcast search." }) };
    setPodcast(ctx, chosen);
    return { content: JSON.stringify({ selected: { id: chosen.id, name: chosen.name } }) };
  }
  const query = p.query ?? ctx.state.podcast?.name ?? "";
  const hits = await traced(ctx, { actor: "agent", tool: "resolve_podcast", title: `Search the taste graph for “${query}”`, params: { query, type: "urn:entity:podcast" }, thought }, async () => {
    const r = await resolvePodcast(ctx, query);
    return { value: r, summary: r.length ? `${r.length} podcast matches; best: ${r[0].name}` : "No podcast matches", counts: { matches: r.length } };
  });
  ctx.state.podcastCandidates = hits;
  if (!hits.length) return { content: JSON.stringify({ matches: [], note: "No podcast found. Try a shorter or different name." }) };
  // Auto-select an exact name match, otherwise the most popular result.
  const exact = hits.find((h) => h.name.toLowerCase() === query.toLowerCase());
  const chosen = exact ?? hits[0];
  setPodcast(ctx, chosen);
  return {
    content: JSON.stringify({
      selected: { id: chosen.id, name: chosen.name, genres: chosen.genres },
      alternatives: hits.filter((h) => h !== chosen).slice(0, 4).map((h) => ({ id: h.id, name: h.name })),
      note: "If the selected show is wrong, call resolve_podcast with select_id.",
    }),
  };
}

async function toolProfile(ctx: RunContext, domains: DomainKey[], thought?: string): Promise<ToolResult> {
  const prof = await traced(
    ctx,
    { actor: "agent", tool: "audience_profile", title: "Map what listeners love across domains", params: { domains, take: 40 }, thought },
    async () => {
      const m = await loadProfile(ctx, domains);
      const counts = Object.fromEntries(domains.map((d) => [DOMAINS[d].label, m.get(d)?.length ?? 0]));
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { value: m, summary: `${total} entities across ${domains.length} domains`, counts };
    },
  );
  const out: Record<string, string[]> = {};
  for (const d of domains) out[d] = names(prof.get(d) ?? [], 5);
  return { content: JSON.stringify({ top_by_domain: out }) };
}

async function toolCandidates(ctx: RunContext, take: number, thought?: string): Promise<ToolResult> {
  const kept = await traced(
    ctx,
    { actor: "agent", tool: "brand_candidates", title: "Rank brands by listener affinity", params: { "filter.type": "urn:entity:brand", take, exclude: ctx.exclude }, thought },
    async () => {
      const k = await loadCandidates(ctx, take);
      const removed = ctx.state.filteredOut.length;
      return { value: k, summary: `${k.length} brands${removed ? `, ${removed} removed by brand-safety` : ""}`, counts: { brands: k.length, filtered: removed } };
    },
  );
  return {
    content: JSON.stringify({
      brands: kept.slice(0, 25).map((b) => ({ id: b.id, name: b.name, category: b.category ?? null, group: b.group ?? null, affinity: b.affinity !== undefined ? Number(b.affinity.toFixed(3)) : null })),
      filtered_out_by_safety: ctx.state.filteredOut.slice(0, 10),
      next: `Pick ${config.agent.deepDiveBrands} varied brands for brand_fan_profile, in one call.`,
    }),
  };
}

async function toolFanProfile(ctx: RunContext, refs: string[], domains: DomainKey[], thought?: string): Promise<ToolResult> {
  if (!ctx.state.candidates) await loadCandidates(ctx);
  const { found, unknown } = matchCandidates(ctx, refs);
  const room = Math.max(0, config.agent.deepDiveBrands - ctx.state.brandProfiles.size);
  const already = found.filter((b) => ctx.state.brandProfiles.has(b.id));
  const fresh = found.filter((b) => !ctx.state.brandProfiles.has(b.id)).slice(0, room);
  if (!fresh.length && !already.length) {
    return { content: JSON.stringify({ error: "None of those ids are known brand candidates.", unknown }) };
  }
  await traced(
    ctx,
    {
      actor: "agent",
      tool: "brand_fan_profile",
      title: `Profile fans of ${fresh.map((b) => b.name).join(", ") || "selected brands"}`,
      params: { brands: fresh.map((b) => b.name), domains, "filter.results.entities": "listeners' top 20 per domain" },
      thought,
    },
    async () => {
      await loadFanProfiles(ctx, fresh, domains);
      return { value: null, summary: `${fresh.length} brands × ${domains.length} domains`, counts: { brands: fresh.length, domains: domains.length } };
    },
  );
  return {
    content: JSON.stringify({
      profiled: [...already, ...fresh].map((b) => b.name),
      ignored_unknown: unknown,
      skipped_over_limit: found.length - already.length - fresh.length,
      next: "Call overlap_evidence.",
    }),
  };
}

async function toolOverlap(ctx: RunContext, refs: string[] | undefined, thought?: string): Promise<ToolResult> {
  const ids = refs?.length ? matchCandidates(ctx, refs).found.map((b) => b.id) : undefined;
  const res = await traced(ctx, { actor: "code", tool: "overlap_evidence", title: "Compute listener ↔ brand-fan taste overlap", params: { method: "weighted Jaccard of Qloo affinities, listeners vs brand fans, same 20 items per domain" }, thought }, async () => {
    const r = computeOverlaps(ctx, ids);
    const shared = r.reduce((a, o) => a + (o?.shared.length ?? 0), 0);
    return { value: r, summary: `${r.length} brands compared, ${shared} shared favourites found`, counts: { brands: r.length, shared } };
  });
  const cands = ctx.state.candidates ?? [];
  return {
    content: JSON.stringify({
      overlaps: res.map((o) => ({
        brand: cands.find((c) => c.id === o!.brandId)?.name,
        overlap: Number(o!.raw.toFixed(3)),
        shared_examples: o!.shared.slice(0, 3).map((s) => `${s.entity.name} (${DOMAINS[s.domain].label})`),
      })),
      next: "Optionally call demographics and geography, then rank_sponsors.",
    }),
  };
}

async function toolDemographics(ctx: RunContext, thought?: string): Promise<ToolResult> {
  const d = await traced(ctx, { actor: "agent", tool: "demographics", title: "Audience age & gender skew", params: { "filter.type": "urn:demographics" }, thought }, async () => {
    const v = await loadDemographics(ctx);
    return { value: v, summary: v ? "Age and gender skew loaded" : "Not available for this show" };
  });
  return { content: JSON.stringify(d ? { age: d.age, gender: d.gender } : { available: false }) };
}

async function toolGeography(ctx: RunContext, thought?: string): Promise<ToolResult> {
  const g = await traced(ctx, { actor: "agent", tool: "geography", title: "Where the audience over-indexes", params: { "filter.type": "urn:heatmap", "output.heatmap.boundary": "urn:geohash" }, thought }, async () => {
    const v = await loadGeography(ctx);
    return { value: v, summary: v?.length ? `Top: ${v.slice(0, 3).map((x) => x.name).join(", ")}` : "Not available", counts: { places: v?.length ?? 0 } };
  });
  return { content: JSON.stringify(g?.length ? { top: g.slice(0, 5).map((x) => x.name) } : { available: false }) };
}

export async function toolRank(ctx: RunContext, actor: "agent" | "guardrail", thought?: string): Promise<ToolResult> {
  // Make sure the inputs exist even if the agent skipped a step or stopped short
  // of a full shortlist.
  const chosen = (ctx.state.candidates ?? []).filter((b) => ctx.state.brandProfiles.has(b.id));
  const picks = defaultDeepDive(ctx.state.candidates ?? [], config.agent.deepDiveBrands, chosen);
  if (picks.length) {
    const title = chosen.length ? `Top up the shortlist with ${picks.length} more varied brands` : `Profile fans of the top ${picks.length} candidates`;
    await traced(ctx, { actor: "guardrail", tool: "brand_fan_profile", title, params: { brands: picks.map((b) => b.name) } }, async () => {
      await loadFanProfiles(ctx, picks);
      return { value: null, summary: `${picks.length} brands × ${OVERLAP_DOMAINS.length} domains` };
    });
  }
  if (ctx.state.overlaps.size < ctx.state.brandProfiles.size) computeOverlaps(ctx);
  const deck = await traced(
    ctx,
    { actor, tool: "rank_sponsors", title: "Score & rank sponsors (deterministic)", params: { formula: "100 × (0.50·A + 0.35·O + 0.15·S)" }, thought },
    async () => {
      const d = await rank(ctx);
      const surprises = d.filter((c) => c.surpriseFit).length;
      return { value: d, summary: `${d.length} sponsors ranked; ${surprises} surprise fits`, counts: { ranked: d.length, surprise: surprises } };
    },
  );
  return {
    ranked: true,
    content: JSON.stringify({
      ranking: deck.map((c) => ({ rank: c.rank, brand: c.brand.name, fit: c.fit, surprise_fit: c.surpriseFit, evidence: c.topEvidence.map((e) => e.entity.name) })),
      next: "Reply with your 2–3 sentence summary of this audience's taste. No more tool calls.",
    }),
  };
}
