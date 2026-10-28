// Deterministic fit scoring. The LLM never computes or adjusts scores.
//
//   Fit = 100 × (0.50·A + 0.35·O + 0.15·S)
//
//   A  audience affinity  — Qloo's affinity of the brand for this show's
//                           listeners, min-max normalised across the candidate pool
//   O  taste overlap      — mean weighted Jaccard per domain over the listeners'
//                           top favourites, comparing the listeners' Qloo affinity
//                           for each item with the brand fans' affinity for it;
//                           min-max normalised within the deck
//   S  surprise           — 1 if the plain-LLM baseline did not name the brand
//
// Fit is a relative ranking within one show's deck, not a revenue prediction.
//
// Brand-side mode runs the same overlap check the other way round (the brand
// fans' favourites, and each podcast's listeners' affinity for them):
//
//   Fit = 100 × (0.60·A + 0.40·O)
import type { BrandEntity, DomainKey, DomainProfile, OverlapResult, PodcastEntity, PodcastMatch, ScoreBreakdown, SharedEntity, SponsorCard, TasteEntity } from "./types";

export const WEIGHTS = { affinity: 0.5, overlap: 0.35, surprise: 0.15 } as const;

export const FORMULA_TEXT = "Fit = 100 × (0.50·A + 0.35·O + 0.15·S)";

export const BRAND_SIDE_WEIGHTS = { affinity: 0.6, overlap: 0.4 } as const;

export const BRAND_SIDE_FORMULA = "Fit = 100 × (0.60·A + 0.40·O)";

/** A favourite counts as evidence when the brand's fans score it at least this high. */
export const EVIDENCE_MIN_WEIGHT = 0.75;

/** Linear rank weight: 1 for #1, ~1/N for #N. */
export function rankWeight(rank: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, (total - rank + 1) / total);
}

/** Qloo affinity when present, else a rank weight. */
function weights(entities: TasteEntity[]): Map<string, { w: number; e: TasteEntity }> {
  const m = new Map<string, { w: number; e: TasteEntity }>();
  entities.forEach((e, i) => {
    const rank = e.rank ?? i + 1;
    const w = typeof e.affinity === "number" ? e.affinity : rankWeight(rank, entities.length);
    if (!m.has(e.id)) m.set(e.id, { w, e });
  });
  return m;
}

/** Weighted Jaccard: Σ min(wL, wB) / Σ max(wL, wB) over the union of entities. */
export function weightedJaccard(listeners: TasteEntity[], fans: TasteEntity[]): { score: number; shared: { e: TasteEntity; wl: number; wb: number }[] } {
  const L = weights(listeners);
  const B = weights(fans);
  let num = 0;
  let den = 0;
  const shared: { e: TasteEntity; wl: number; wb: number }[] = [];
  const ids = new Set([...L.keys(), ...B.keys()]);
  for (const id of ids) {
    const wl = L.get(id)?.w ?? 0;
    const wb = B.get(id)?.w ?? 0;
    num += Math.min(wl, wb);
    den += Math.max(wl, wb);
    if (wl > 0 && wb > 0) shared.push({ e: L.get(id)!.e, wl, wb });
  }
  return { score: den > 0 ? num / den : 0, shared };
}

/**
 * Overlap of two audiences on one audience's favourites. `listenerProfile` holds
 * the favourites with that audience's affinities; `brandProfile` holds the other
 * audience's affinity for the same items. Evidence is a favourite the other
 * audience also scores at least EVIDENCE_MIN_WEIGHT.
 */
export function computeOverlap(brandId: string, listenerProfile: DomainProfile[], brandProfile: DomainProfile[]): OverlapResult {
  const perDomain: Partial<Record<DomainKey, number>> = {};
  const shared: SharedEntity[] = [];
  let sum = 0;
  let n = 0;
  for (const bp of brandProfile) {
    const lp = listenerProfile.find((p) => p.domain === bp.domain);
    if (!lp || lp.entities.length === 0 || bp.entities.length === 0) continue;
    const { score, shared: s } = weightedJaccard(lp.entities, bp.entities);
    perDomain[bp.domain] = round(score, 4);
    sum += score;
    n++;
    for (const x of s) if (x.wb >= EVIDENCE_MIN_WEIGHT) shared.push({ domain: bp.domain, entity: x.e, listenerWeight: round(x.wl, 3), brandWeight: round(x.wb, 3) });
  }
  shared.sort((a, b) => b.listenerWeight * b.brandWeight - a.listenerWeight * a.brandWeight);
  return { brandId, perDomain, raw: n ? round(sum / n, 4) : 0, shared };
}

/**
 * Pick up to `k` evidence items, preferring one per domain and taking the
 * `prefer` domains first (in order) when they have evidence.
 */
export function pickTopEvidence(shared: SharedEntity[], k = 3, prefer: DomainKey[] = []): SharedEntity[] {
  const out: SharedEntity[] = [];
  const used = new Set<DomainKey>();
  for (const d of prefer) {
    if (out.length >= k) break;
    const s = shared.find((x) => x.domain === d);
    if (s) {
      out.push(s);
      used.add(d);
    }
  }
  for (const s of shared) {
    if (out.length >= k) break;
    if (!used.has(s.domain)) {
      out.push(s);
      used.add(s.domain);
    }
  }
  for (const s of shared) {
    if (out.length >= k) break;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

function round(x: number, d = 3): number {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

/** Normalised affinity A for each candidate (min-max over the pool, rank fallback). */
export function normaliseAffinity(pool: TasteEntity[]): Map<string, { a: number; raw?: number }> {
  const out = new Map<string, { a: number; raw?: number }>();
  const withAff = pool.filter((b) => typeof b.affinity === "number");
  if (withAff.length >= 2) {
    const vals = withAff.map((b) => b.affinity as number);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    for (const b of pool) {
      if (typeof b.affinity === "number") out.set(b.id, { a: max > min ? (b.affinity - min) / (max - min) : 1, raw: b.affinity });
      else out.set(b.id, { a: 0 });
    }
    return out;
  }
  pool.forEach((b, i) => out.set(b.id, { a: rankWeight(b.rank ?? i + 1, pool.length), raw: b.affinity }));
  return out;
}

export interface ScoreInput {
  pool: BrandEntity[];
  /** Brands that were deep-dived (have overlap results). */
  overlaps: OverlapResult[];
  /** Returns true when the plain-LLM baseline named this brand. */
  namedByBaseline: (brand: BrandEntity) => boolean;
}

/** O for each overlap result: min-max of the raw overlap within the deck. */
function normaliseOverlap(overlaps: OverlapResult[]): (o: OverlapResult) => number {
  const raws = overlaps.map((o) => o.raw);
  const minRaw = Math.min(...raws);
  const maxRaw = Math.max(...raws);
  return (o) => (maxRaw > minRaw ? (o.raw - minRaw) / (maxRaw - minRaw) : maxRaw > 0 ? 1 : 0);
}

// Headline chips lead with pop culture (film, TV, music), the most relatable in a
// pitch; books come last because affinity lists there lean to heavy nonfiction.
const CHIP_DOMAINS: DomainKey[] = ["film", "tv", "music", "dining", "travel", "podcasts", "books"];

/**
 * Headline chips for one result. A favourite every result shares says little
 * about any one of them, so chips prefer items this result's side (brandWeight)
 * likes more than the average across all results.
 */
function headlineEvidence(overlaps: OverlapResult[]): (o: OverlapResult) => SharedEntity[] {
  const sums = new Map<string, number>();
  for (const o of overlaps) for (const s of o.shared) sums.set(s.entity.id, (sums.get(s.entity.id) ?? 0) + s.brandWeight);
  const lift = (s: SharedEntity) => s.brandWeight - (sums.get(s.entity.id) ?? 0) / overlaps.length;
  return (o) =>
    pickTopEvidence(
      [...o.shared].sort((x, y) => lift(y) - lift(x) || y.listenerWeight * y.brandWeight - x.listenerWeight * x.brandWeight),
      3,
      CHIP_DOMAINS,
    );
}

export function scoreDeck({ pool, overlaps, namedByBaseline }: ScoreInput): SponsorCard[] {
  const A = normaliseAffinity(pool);
  const O = normaliseOverlap(overlaps);
  const chips = headlineEvidence(overlaps);
  const cards: SponsorCard[] = [];
  for (const o of overlaps) {
    const brand = pool.find((b) => b.id === o.brandId);
    if (!brand) continue;
    const a = A.get(brand.id)?.a ?? 0;
    const ov = O(o);
    const surprise = namedByBaseline(brand) ? 0 : 1;
    const score: ScoreBreakdown = {
      affinity: round(a),
      overlap: round(ov),
      surprise,
      rawAffinity: A.get(brand.id)?.raw,
      rawOverlap: o.raw,
    };
    const fit = Math.round(100 * (WEIGHTS.affinity * a + WEIGHTS.overlap * ov + WEIGHTS.surprise * surprise));
    cards.push({
      rank: 0,
      brand,
      fit,
      score,
      surpriseFit: surprise === 1,
      evidence: o.shared.slice(0, 24),
      topEvidence: chips(o),
      perDomain: o.perDomain,
    });
  }
  cards.sort((x, y) => y.fit - x.fit || (y.score.rawAffinity ?? 0) - (x.score.rawAffinity ?? 0) || x.brand.name.localeCompare(y.brand.name));
  cards.forEach((c, i) => (c.rank = i + 1));
  return cards;
}

/**
 * Brand-side ranking. `overlaps` come from computeOverlap(podcastId, the brand
 * fans' favourites, the podcast listeners' affinity for them), so each shared
 * item's listenerWeight is the fans' affinity until it is flipped for the UI.
 */
export function scorePodcastMatches(pool: PodcastEntity[], overlaps: OverlapResult[]): PodcastMatch[] {
  const A = normaliseAffinity(pool);
  const O = normaliseOverlap(overlaps);
  const chips = headlineEvidence(overlaps);
  const flip = (s: SharedEntity): SharedEntity => ({ ...s, listenerWeight: s.brandWeight, brandWeight: s.listenerWeight });
  const matches: PodcastMatch[] = [];
  for (const o of overlaps) {
    const podcast = pool.find((p) => p.id === o.brandId);
    if (!podcast) continue;
    const a = A.get(podcast.id)?.a ?? 0;
    const ov = O(o);
    matches.push({
      rank: 0,
      podcast,
      fit: Math.round(100 * (BRAND_SIDE_WEIGHTS.affinity * a + BRAND_SIDE_WEIGHTS.overlap * ov)),
      score: { affinity: round(a), overlap: round(ov), rawAffinity: A.get(podcast.id)?.raw, rawOverlap: o.raw },
      evidence: o.shared.slice(0, 24).map(flip),
      topEvidence: chips(o).map(flip),
      perDomain: o.perDomain,
    });
  }
  matches.sort((x, y) => y.fit - x.fit || (y.score.rawAffinity ?? 0) - (x.score.rawAffinity ?? 0) || x.podcast.name.localeCompare(y.podcast.name));
  matches.forEach((m, i) => (m.rank = i + 1));
  return matches;
}
