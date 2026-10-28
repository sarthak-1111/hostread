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
import type { BrandEntity, DomainKey, DomainProfile, OverlapResult, ScoreBreakdown, SharedEntity, SponsorCard, TasteEntity } from "./types";

export const WEIGHTS = { affinity: 0.5, overlap: 0.35, surprise: 0.15 } as const;

export const FORMULA_TEXT = "Fit = 100 × (0.50·A + 0.35·O + 0.15·S)";

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
export function normaliseAffinity(pool: BrandEntity[]): Map<string, { a: number; raw?: number }> {
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

export function scoreDeck({ pool, overlaps, namedByBaseline }: ScoreInput): SponsorCard[] {
  const A = normaliseAffinity(pool);
  const raws = overlaps.map((o) => o.raw);
  const minRaw = Math.min(...raws);
  const maxRaw = Math.max(...raws);
  // A favourite every brand's fans love says little about any one brand, so the
  // headline chips prefer items this brand's fans like more than the deck average.
  const fanSum = new Map<string, { sum: number; n: number }>();
  for (const o of overlaps)
    for (const s of o.shared) {
      const t = fanSum.get(s.entity.id) ?? { sum: 0, n: 0 };
      fanSum.set(s.entity.id, { sum: t.sum + s.brandWeight, n: t.n + 1 });
    }
  const lift = (s: SharedEntity) => {
    const t = fanSum.get(s.entity.id);
    return s.brandWeight - (t ? t.sum / overlaps.length : 0);
  };
  const cards: SponsorCard[] = [];
  for (const o of overlaps) {
    const brand = pool.find((b) => b.id === o.brandId);
    if (!brand) continue;
    const a = A.get(brand.id)?.a ?? 0;
    const ov = maxRaw > minRaw ? (o.raw - minRaw) / (maxRaw - minRaw) : maxRaw > 0 ? 1 : 0;
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
      // Headline chips lead with pop culture (film, TV, music), the most relatable in a
      // pitch; books come last because affinity lists there lean to heavy nonfiction.
      topEvidence: pickTopEvidence(
        [...o.shared].sort((x, y) => lift(y) - lift(x) || y.listenerWeight * y.brandWeight - x.listenerWeight * x.brandWeight),
        3,
        ["film", "tv", "music", "dining", "travel", "podcasts", "books"],
      ),
      perDomain: o.perDomain,
    });
  }
  cards.sort((x, y) => y.fit - x.fit || (y.score.rawAffinity ?? 0) - (x.score.rawAffinity ?? 0) || x.brand.name.localeCompare(y.brand.name));
  cards.forEach((c, i) => (c.rank = i + 1));
  return cards;
}
