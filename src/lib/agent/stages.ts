// The work behind each agent tool. Tools (LLM-chosen) and guardrails
// (auto-completion when the LLM stops early or is unavailable) both call
// these, so a run always produces the same kind of deck.
import "server-only";
import { config } from "../config";
import { DOMAINS, OVERLAP_DOMAINS, PROFILE_DOMAINS } from "../domains";
import { mapLimit } from "../limiter";
import { sameBrand } from "../names";
import { brandSafetyCategories } from "../safety";
import { computeOverlap, scoreDeck } from "../scoring";
import type { BaselinePick, BaselineResult, BrandEntity, DomainKey, DomainProfile, PodcastEntity, TasteEntity } from "../types";
import type { RunContext } from "./context";

const QLOO_PARALLEL = 4;

export async function resolvePodcast(ctx: RunContext, query: string): Promise<PodcastEntity[]> {
  return ctx.qloo.searchPodcasts(query, 6);
}

export function setPodcast(ctx: RunContext, p: PodcastEntity) {
  ctx.state.podcast = p;
  ctx.emit({ type: "podcast", podcast: p });
}

export async function loadProfile(ctx: RunContext, domains: DomainKey[] = PROFILE_DOMAINS, take = 40): Promise<Map<DomainKey, TasteEntity[]>> {
  const p = requirePodcast(ctx);
  const todo = domains.filter((d) => !ctx.state.profile.has(d));
  await mapLimit(todo, QLOO_PARALLEL, async (d) => {
    try {
      const list = await ctx.qloo.domainProfile(p.id, d, take);
      ctx.state.profile.set(d, list);
    } catch (err) {
      if ((err as Error).name === "BudgetExceededError") throw err;
      // One domain failing (e.g. unsupported type) shouldn't sink the run.
      ctx.state.profile.set(d, []);
    }
  });
  emitProfile(ctx);
  return ctx.state.profile;
}

export function emitProfile(ctx: RunContext) {
  const profile: DomainProfile[] = PROFILE_DOMAINS.filter((d) => ctx.state.profile.has(d)).map((d) => ({ domain: d, entities: ctx.state.profile.get(d)! }));
  ctx.emit({ type: "profile", profile });
}

export async function loadCandidates(ctx: RunContext, take = 50): Promise<BrandEntity[]> {
  if (ctx.state.candidates) return ctx.state.candidates;
  const p = requirePodcast(ctx);
  const raw = await ctx.qloo.brandCandidates(p.id, take);
  const kept: BrandEntity[] = [];
  ctx.state.filteredOut = [];
  for (const b of raw) {
    const cats = brandSafetyCategories(b, ctx.qloo.sampleSafety(b.id));
    const hit = cats.find((c) => ctx.exclude.includes(c));
    if (hit) ctx.state.filteredOut.push({ name: b.name, category: hit });
    else kept.push(b);
  }
  ctx.state.candidates = kept;
  ctx.emit({ type: "candidates", count: kept.length });
  return kept;
}

/** Default deep-dive selection: highest affinity, at most 2 per category. */
export function defaultDeepDive(candidates: BrandEntity[], n = config.agent.deepDiveBrands): BrandEntity[] {
  const perCat = new Map<string, number>();
  const out: BrandEntity[] = [];
  for (const b of candidates) {
    if (out.length >= n) break;
    const cat = (b.category ?? "other").toLowerCase();
    const used = perCat.get(cat) ?? 0;
    if (used >= 2) continue;
    perCat.set(cat, used + 1);
    out.push(b);
  }
  return out;
}

/** Map ids or names the LLM passed to known candidates. */
export function matchCandidates(ctx: RunContext, refs: string[]): { found: BrandEntity[]; unknown: string[] } {
  const cands = ctx.state.candidates ?? [];
  const found: BrandEntity[] = [];
  const unknown: string[] = [];
  for (const r of refs) {
    const b = cands.find((c) => c.id === r) ?? cands.find((c) => sameBrand(c.name, r));
    if (b && !found.includes(b)) found.push(b);
    else if (!b) unknown.push(r);
  }
  return { found, unknown };
}

export async function loadFanProfiles(ctx: RunContext, brands: BrandEntity[], domains: DomainKey[] = OVERLAP_DOMAINS, take = 40): Promise<void> {
  const jobs: { brand: BrandEntity; domain: DomainKey }[] = [];
  for (const b of brands) {
    const have = new Set((ctx.state.brandProfiles.get(b.id) ?? []).map((p) => p.domain));
    for (const d of domains) if (!have.has(d)) jobs.push({ brand: b, domain: d });
  }
  await mapLimit(jobs, QLOO_PARALLEL, async ({ brand, domain }) => {
    let entities: TasteEntity[] = [];
    try {
      entities = await ctx.qloo.domainProfile(brand.id, domain, take);
    } catch (err) {
      if ((err as Error).name === "BudgetExceededError") throw err;
    }
    const list = ctx.state.brandProfiles.get(brand.id) ?? [];
    list.push({ domain, entities });
    ctx.state.brandProfiles.set(brand.id, list);
  });
}

export function computeOverlaps(ctx: RunContext, brandIds?: string[]) {
  const listener: DomainProfile[] = [...ctx.state.profile.entries()].map(([domain, entities]) => ({ domain, entities }));
  const ids = brandIds?.length ? brandIds : [...ctx.state.brandProfiles.keys()];
  for (const id of ids) {
    const bp = ctx.state.brandProfiles.get(id);
    if (!bp) continue;
    ctx.state.overlaps.set(id, computeOverlap(id, listener, bp));
  }
  return ids.map((id) => ctx.state.overlaps.get(id)).filter(Boolean);
}

export async function loadDemographics(ctx: RunContext) {
  if (ctx.state.demographics !== undefined) return ctx.state.demographics;
  const p = requirePodcast(ctx);
  try {
    ctx.state.demographics = await ctx.qloo.demographics(p.id);
  } catch (err) {
    if ((err as Error).name === "BudgetExceededError") throw err;
    ctx.state.demographics = null;
  }
  ctx.emit({ type: "demographics", demographics: ctx.state.demographics ?? null });
  return ctx.state.demographics;
}

export async function loadGeography(ctx: RunContext) {
  if (ctx.state.geography !== undefined) return ctx.state.geography;
  const p = requirePodcast(ctx);
  try {
    ctx.state.geography = await ctx.qloo.geography(p.id);
  } catch (err) {
    if ((err as Error).name === "BudgetExceededError") throw err;
    ctx.state.geography = null;
  }
  ctx.emit({ type: "geography", geography: ctx.state.geography ?? null });
  return ctx.state.geography;
}

/** Resolve the baseline's brand names against Qloo and score their audience affinity. */
export async function checkBaseline(ctx: RunContext, names: string[] | null): Promise<BaselineResult> {
  if (!names) return { available: false, picks: [], note: "The plain-LLM baseline wasn't available for this run." };
  const p = requirePodcast(ctx);
  const cands = ctx.state.candidates ?? [];
  const picks: BaselinePick[] = names.slice(0, 10).map((name) => ({ name, inDeck: false }));

  // 1) match against candidates we already have (free)
  for (const pick of picks) {
    const c = cands.find((b) => sameBrand(b.name, pick.name));
    if (c) {
      pick.matched = c;
      pick.affinity = c.affinity;
    }
  }
  // 2) search the rest
  await mapLimit(
    picks.filter((x) => !x.matched),
    QLOO_PARALLEL,
    async (pick) => {
      try {
        const hits = await ctx.qloo.searchBrands(pick.name, 3);
        const best = hits.find((h) => sameBrand(h.name, pick.name));
        if (best) pick.matched = best;
      } catch (err) {
        if ((err as Error).name === "BudgetExceededError") throw err;
      }
    },
  );
  // 3) affinity for matched brands that weren't in the candidate list
  const need = picks.filter((x) => x.matched && x.affinity === undefined).map((x) => x.matched!.id);
  if (need.length) {
    try {
      const aff = await ctx.qloo.brandAffinities(p.id, need);
      for (const pick of picks) {
        const a = aff.find((x) => x.id === pick.matched?.id);
        if (a?.affinity !== undefined) pick.affinity = a.affinity;
      }
    } catch (err) {
      if ((err as Error).name === "BudgetExceededError") throw err;
    }
  }
  // percentile vs the taste-ranked pool
  const poolAff = cands.map((c) => c.affinity).filter((a): a is number => typeof a === "number");
  for (const pick of picks) {
    if (pick.affinity !== undefined && poolAff.length) {
      pick.percentile = poolAff.filter((a) => a <= pick.affinity!).length / poolAff.length;
    }
  }
  return { available: true, picks };
}

export async function rank(ctx: RunContext) {
  const s = ctx.state;
  const cands = s.candidates ?? [];
  let names: string[] | null = null;
  if (s.baselineNames) {
    names = await Promise.race([s.baselineNames, new Promise<null>((r) => setTimeout(() => r(null), 90_000))]);
  }
  const baseline = await checkBaseline(ctx, names);
  const namedByBaseline = (b: BrandEntity) => (names ?? []).some((n) => sameBrand(n, b.name)) || baseline.picks.some((p) => p.matched?.id === b.id);
  const overlaps = [...s.overlaps.values()];
  const deck = scoreDeck({ pool: cands, overlaps, namedByBaseline });
  for (const pick of baseline.picks) pick.inDeck = deck.some((c) => c.brand.id === pick.matched?.id || sameBrand(c.brand.name, pick.name));
  s.deck = deck;
  s.baseline = baseline;
  ctx.emit({ type: "deck", deck, filteredOut: s.filteredOut });
  ctx.emit({ type: "baseline", baseline });
  return deck;
}

function requirePodcast(ctx: RunContext): PodcastEntity {
  if (!ctx.state.podcast) throw new Error("No podcast resolved yet — call resolve_podcast first.");
  return ctx.state.podcast;
}

export function domainLabel(d: DomainKey) {
  return DOMAINS[d].label;
}
