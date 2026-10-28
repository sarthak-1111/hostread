import { describe, expect, it } from "vitest";
import { computeOverlap, normaliseAffinity, pickTopEvidence, rankWeight, scoreDeck, weightedJaccard } from "@/lib/scoring";
import type { BrandEntity, DomainProfile, TasteEntity } from "@/lib/types";

const ent = (id: string, rank: number): TasteEntity => ({ id, name: id.toUpperCase(), type: "urn:entity:movie", rank });

describe("weightedJaccard", () => {
  it("is 1 for identical ranked lists and 0 for disjoint lists", () => {
    const a = [ent("a", 1), ent("b", 2), ent("c", 3)];
    expect(weightedJaccard(a, a).score).toBeCloseTo(1);
    expect(weightedJaccard(a, [ent("x", 1), ent("y", 2)]).score).toBe(0);
  });

  it("rewards overlap near the top more than overlap near the bottom", () => {
    const listeners = [ent("a", 1), ent("b", 2), ent("c", 3), ent("d", 4)];
    const top = weightedJaccard(listeners, [ent("a", 1), ent("x", 2), ent("y", 3), ent("z", 4)]);
    const bottom = weightedJaccard(listeners, [ent("x", 1), ent("y", 2), ent("z", 3), ent("d", 4)]);
    expect(top.score).toBeGreaterThan(bottom.score);
    expect(top.shared.map((s) => s.e.id)).toEqual(["a"]);
  });
});

describe("rankWeight", () => {
  it("is linear from 1 down to 1/N", () => {
    expect(rankWeight(1, 4)).toBe(1);
    expect(rankWeight(4, 4)).toBe(0.25);
  });
});

const aff = (id: string, affinity: number): TasteEntity => ({ id, name: id.toUpperCase(), type: "urn:entity:movie", affinity });

describe("computeOverlap + pickTopEvidence", () => {
  // The listeners' favourites, and the brand fans' Qloo affinity for those same items.
  const listeners: DomainProfile[] = [
    { domain: "film", entities: [aff("f1", 0.95), aff("f2", 0.9), aff("f3", 0.85)] },
    { domain: "music", entities: [aff("m1", 0.95), aff("m2", 0.9)] },
  ];
  const fans: DomainProfile[] = [
    { domain: "film", entities: [aff("f1", 0.9), aff("f2", 0.6), aff("f3", 0.8)] },
    { domain: "music", entities: [aff("m1", 0.7), aff("m2", 0.85)] },
  ];
  it("compares affinities on the same items and keeps well-liked items as evidence", () => {
    const o = computeOverlap("b1", listeners, fans);
    expect(Object.keys(o.perDomain).sort()).toEqual(["film", "music"]);
    // film: Σ min / Σ max = (0.9 + 0.6 + 0.8) / (0.95 + 0.9 + 0.85)
    expect(o.perDomain.film).toBeCloseTo(2.3 / 2.7, 3);
    expect(o.shared.map((s) => s.entity.id).sort()).toEqual(["f1", "f3", "m2"]);
  });
  it("scores fans who like the listeners' favourites less lower", () => {
    const cooler: DomainProfile[] = [{ domain: "film", entities: [aff("f1", 0.6), aff("f2", 0.55), aff("f3", 0.5)] }];
    expect(computeOverlap("b2", listeners, cooler).raw).toBeLessThan(computeOverlap("b1", listeners, fans).perDomain.film!);
  });
  it("prefers evidence from different domains", () => {
    const o = computeOverlap("b1", listeners, fans);
    const top = pickTopEvidence(o.shared, 2);
    expect(new Set(top.map((t) => t.domain)).size).toBe(2);
  });
});

describe("normaliseAffinity", () => {
  it("min-max normalises raw affinity", () => {
    const pool: BrandEntity[] = [
      { id: "a", name: "A", type: "urn:entity:brand", affinity: 0.9 },
      { id: "b", name: "B", type: "urn:entity:brand", affinity: 0.7 },
      { id: "c", name: "C", type: "urn:entity:brand", affinity: 0.8 },
    ];
    const m = normaliseAffinity(pool);
    expect(m.get("a")!.a).toBe(1);
    expect(m.get("b")!.a).toBe(0);
    expect(m.get("c")!.a).toBeCloseTo(0.5);
  });
});

describe("scoreDeck", () => {
  it("applies Fit = 100 × (0.50·A + 0.35·O + 0.15·S) and ranks descending", () => {
    const pool: BrandEntity[] = [
      { id: "a", name: "Alpha", type: "urn:entity:brand", affinity: 0.9 },
      { id: "b", name: "Beta", type: "urn:entity:brand", affinity: 0.7 },
      { id: "c", name: "Gamma", type: "urn:entity:brand", affinity: 0.8 },
    ];
    const deck = scoreDeck({
      pool,
      overlaps: [
        { brandId: "a", perDomain: { film: 0.15 }, raw: 0.15, shared: [] },
        { brandId: "b", perDomain: { film: 0.2 }, raw: 0.2, shared: [] },
        { brandId: "c", perDomain: { film: 0.1 }, raw: 0.1, shared: [] },
      ],
      namedByBaseline: (b) => b.name === "Alpha",
    });
    const fit = (id: string) => deck.find((c) => c.brand.id === id)!.fit;
    // Alpha: A=1, O=0.5 (min-max), S=0 -> 50 + 17.5 = 67.5 -> 68
    expect(fit("a")).toBe(68);
    // Beta: A=0, O=1, S=1 -> 35 + 15 = 50
    expect(fit("b")).toBe(50);
    // Gamma: A=0.5, O=0, S=1 -> 25 + 15 = 40
    expect(fit("c")).toBe(40);
    expect(deck.find((c) => c.brand.id === "b")!.surpriseFit).toBe(true);
    expect(deck.map((c) => c.brand.id)).toEqual(["a", "b", "c"]);
    expect(deck.map((c) => c.rank)).toEqual([1, 2, 3]);
  });
});
