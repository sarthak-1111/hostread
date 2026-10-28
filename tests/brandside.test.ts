import { describe, expect, it } from "vitest";

process.env.QLOO_MODE = "sample";

describe("computeBrandMatch (sample fixtures)", () => {
  it("ranks shows for a brand with fit scores and evidence from the fans' favourites", async () => {
    const { computeBrandMatch, BRAND_SHORTLIST } = await import("@/lib/brandside");
    const { exampleBrandsForMode } = await import("@/lib/qloo/client");
    const brand = exampleBrandsForMode("sample")[0];
    const r = await computeBrandMatch(brand.id);
    expect(r.mode).toBe("sample");
    expect(r.brand.id).toBe(brand.id);
    expect(r.matches.length).toBeGreaterThan(0);
    expect(r.matches.length).toBeLessThanOrEqual(BRAND_SHORTLIST);
    expect(r.matches.map((m) => m.rank)).toEqual(r.matches.map((_, i) => i + 1));
    for (let i = 1; i < r.matches.length; i++) expect(r.matches[i - 1].fit).toBeGreaterThanOrEqual(r.matches[i].fit);
    // Every evidence item is one of the fans' favourites, and the listeners scored it 0.75+.
    const favs = new Set(r.fanProfile.flatMap((p) => p.entities.map((e) => e.id)));
    for (const m of r.matches)
      for (const e of m.evidence) {
        expect(favs.has(e.entity.id)).toBe(true);
        expect(e.listenerWeight).toBeGreaterThanOrEqual(0.75);
      }
    expect(r.stats.apiCalls).toBeLessThanOrEqual(60);
  });
});
