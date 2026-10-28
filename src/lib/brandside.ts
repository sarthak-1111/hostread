// Brand-side mode: a brand finds the podcasts whose listeners already love it.
//
// No LLM here. Qloo ranks podcasts by affinity among the brand's fans; for the
// top few, the same dense overlap check as the sponsor deck runs the other way
// round: the brand fans' favourites in film, TV, music, books and food & drink,
// and each podcast's listeners' Qloo affinity for those same items.
import { BRAND_MATCH_VERSION, dataMode } from "./config";
import { hashKey } from "./cache";
import { OVERLAP_DOMAINS } from "./domains";
import { BudgetExceededError, TasteClient } from "./qloo/client";
import { computeOverlap, scorePodcastMatches } from "./scoring";
import type { BrandEntity, BrandMatchResult, DomainProfile, OverlapResult } from "./types";

/** Podcasts ranked by Qloo for the brand's fans. */
export const BRAND_CANDIDATES = 30;
/** How many of them get the overlap check (5 calls each). */
export const BRAND_SHORTLIST = 8;
/** Brand fans' favourites per domain compared with each show's listeners. */
const FAV_ITEMS = 20;
/** 1 entity + 1 podcast list + 5 fan profiles + 8 × 5 overlap lookups = 47. */
const CALL_BUDGET = 60;

export class BrandMatchError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "NO_PODCASTS" | "NO_PROFILE",
  ) {
    super(message);
    this.name = "BrandMatchError";
  }
}

export function brandMatchKey(brandId: string): string {
  return `brand:${BRAND_MATCH_VERSION}:${dataMode()}:${hashKey(brandId)}`;
}

/** Resolve a brand by name with Qloo search (top hit). */
export async function findBrand(query: string): Promise<BrandEntity | undefined> {
  return (await new TasteClient(2).searchBrands(query, 3))[0];
}

export async function computeBrandMatch(brandId: string, nameHint?: string): Promise<BrandMatchResult> {
  const t0 = Date.now();
  const client = new TasteClient(CALL_BUDGET);
  const brand = await client.getBrand(brandId, nameHint);
  if (!brand) throw new BrandMatchError("That brand isn't in the taste graph. Try searching for it by name.", "NOT_FOUND");

  const [pool, ...fanLists] = await Promise.all([
    client.podcastsForBrand(brand.id, BRAND_CANDIDATES),
    ...OVERLAP_DOMAINS.map((d) => client.domainProfile(brand.id, d, FAV_ITEMS)),
  ]);
  if (pool.length === 0) throw new BrandMatchError(`Qloo has no podcast affinities for fans of ${brand.name} yet.`, "NO_PODCASTS");
  const fanProfile: DomainProfile[] = OVERLAP_DOMAINS.map((domain, i) => ({ domain, entities: fanLists[i] })).filter((p) => p.entities.length > 0);
  if (fanProfile.length === 0) throw new BrandMatchError(`Qloo has no taste profile for fans of ${brand.name} yet.`, "NO_PROFILE");

  const shortlist = pool.slice(0, BRAND_SHORTLIST);
  const overlaps = await Promise.all(
    shortlist.map(async (p): Promise<OverlapResult | undefined> => {
      try {
        const listeners = await Promise.all(
          fanProfile.map(async (fp) => ({ domain: fp.domain, entities: await client.fanAffinity(p.id, fp.domain, fp.entities.map((e) => e.id)) })),
        );
        return computeOverlap(p.id, fanProfile, listeners);
      } catch (err) {
        if (err instanceof BudgetExceededError) throw err;
        // One show's lookups failing shouldn't sink the others.
        return undefined;
      }
    }),
  );
  const done = overlaps.filter((o): o is OverlapResult => Boolean(o));
  if (done.length === 0) throw new Error("The taste-overlap lookups failed. Please try again shortly.");

  const matched = new Set(done.map((o) => o.brandId));
  return {
    matchId: crypto.randomUUID().replace(/-/g, "").slice(0, 12),
    mode: client.mode,
    createdAt: new Date().toISOString(),
    brand,
    fanProfile,
    matches: scorePodcastMatches(pool, done),
    more: pool.filter((p) => !matched.has(p.id)).slice(0, 12),
    stats: { apiCalls: client.stats.apiCalls, ms: Date.now() - t0, candidates: pool.length },
  };
}
