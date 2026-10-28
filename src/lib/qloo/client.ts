// The ONE data-access module for taste data. Everything else (agent tools,
// API routes) goes through TasteClient. Switching between synthetic SAMPLE
// fixtures and the live Qloo API is a config change (QLOO_MODE / QLOO_API_KEY).
//
// Live calls: https://hackathon.api.qloo.com with the X-Api-Key header,
// server-side only. Responses are normalised to small shapes before they are
// cached (in memory / optional KV) — raw payloads are never stored or committed.
import { config, dataMode, type DataMode } from "../config";
import { cacheGet, cacheSet, hashKey } from "../cache";
import { HttpError, Semaphore, fetchWithTimeout, withRetry } from "../limiter";
import { DOMAINS } from "../domains";
import { metrosFromCells, type HeatCell } from "../metros";
import type { BrandEntity, Demographics, DomainKey, GeoPoint, PodcastEntity, Tag, TasteEntity } from "../types";
import * as sample from "./sample";

/** Bump when normalisers change so stale cache entries are ignored. */
const NORM_VERSION = "n2";

const qlooGate = new Semaphore(config.qloo.maxConcurrency);

// The hackathon key has a monthly quota shared by every server instance. Each
// response reports what's left, so the latest value is the real global budget.
let monthlyRemaining: number | undefined;

/** Calls left this month according to the most recent Qloo response, if any. */
export function qlooMonthlyRemaining(): number | undefined {
  return monthlyRemaining;
}

export class BudgetExceededError extends Error {
  constructor(max: number) {
    super(`API call budget of ${max} for this run is used up`);
    this.name = "BudgetExceededError";
  }
}

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

export interface ClientStats {
  apiCalls: number;
  cachedCalls: number;
  errors: number;
}

// ---- normalisers -------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function pickImage(props: any): string | undefined {
  const img = props?.image?.url ?? props?.images?.[0]?.url ?? props?.image;
  return typeof img === "string" && img.startsWith("http") ? img : undefined;
}

function pickDescription(props: any): string | undefined {
  const d = props?.short_description ?? props?.description;
  return typeof d === "string" && d.trim() ? d.trim().slice(0, 280) : undefined;
}

function pickSubtitle(type: string, props: any): string | undefined {
  if (!props) return undefined;
  const year = props.release_year ?? props.publication_year ?? (typeof props.release_date === "string" ? props.release_date.slice(0, 4) : undefined);
  const city = props.geocode?.city ?? props.geocode?.name;
  const country = props.geocode?.country_code;
  if (type.endsWith("place")) return [props.short_address ?? city, country].filter(Boolean).join(", ") || undefined;
  if (type.endsWith("destination")) return [city, country].filter(Boolean).join(", ") || undefined;
  if (type.endsWith("book")) return [props.author ?? props.publisher, year].filter(Boolean).join(" · ") || undefined;
  if (type.endsWith("movie") || type.endsWith("tv_show")) return year ? String(year) : undefined;
  return undefined;
}

function normTags(tags: any): Tag[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags
    .slice(0, 16)
    .map((t: any) => ({ id: String(t.tag_id ?? t.id ?? ""), name: String(t.name ?? ""), type: t.type ?? t.subtype }))
    .filter((t: Tag) => t.name);
}

export function normEntity(e: any, rank?: number): TasteEntity {
  const type = String(e?.subtype ?? (Array.isArray(e?.types) ? e.types[0] : e?.type) ?? "");
  const affinity = e?.query?.affinity ?? e?.affinity;
  return {
    id: String(e?.entity_id ?? e?.id ?? ""),
    name: String(e?.name ?? "Unknown"),
    type,
    affinity: typeof affinity === "number" ? affinity : undefined,
    rank,
    popularity: typeof e?.popularity === "number" ? e.popularity : undefined,
    subtitle: pickSubtitle(type, e?.properties),
    description: pickDescription(e?.properties),
    image: pickImage(e?.properties),
    tags: normTags(e?.tags),
  };
}

const GENERIC_INDUSTRY = /^(retail|e-?commerce|website|online|other|consumer goods)$/i;

/** Brand category: Qloo's industry list first (most specific), then brand tags. */
function brandCategory(e: TasteEntity, props: any): string | undefined {
  const industries: unknown[] = Array.isArray(props?.industry) ? props.industry : Array.isArray(props?.industries) ? props.industries : [];
  const industry = industries.find((x): x is string => typeof x === "string" && x.trim() !== "" && !GENERIC_INDUSTRY.test(x.trim()));
  if (industry) return industry.trim().replace(/^\w/, (c) => c.toUpperCase());
  const subtype = e.tags?.find((x) => /brand_subtype/.test(x.type ?? "") && x.name !== "Other");
  const genre = e.tags?.find((x) => /genre:brand/.test(x.type ?? ""));
  return (subtype ?? genre)?.name;
}

function toBrand(e: TasteEntity, props?: any): BrandEntity {
  const category = brandCategory(e, props);
  return { ...e, category, subtitle: e.subtitle ?? category };
}

function toPodcast(e: TasteEntity): PodcastEntity {
  // Podcast genres come as urn:tag:genre:media tags, including a generic "Podcasts".
  const genres = (e.tags ?? []).filter((t) => /genre|category/i.test(t.type ?? "") && !/^podcasts?$/i.test(t.name)).map((t) => t.name).slice(0, 4);
  return { ...e, genres, subtitle: e.subtitle ?? (genres.length ? genres.join(" · ") : undefined) };
}

function insightsEntities(json: any): any[] {
  const r = json?.results;
  if (Array.isArray(r?.entities)) return r.entities;
  if (Array.isArray(r)) return r;
  return [];
}

function normDemographics(json: any): Demographics | null {
  const d = json?.results?.demographics;
  const q = Array.isArray(d) ? d[0]?.query : d?.query;
  if (!q || (!q.age && !q.gender)) return null;
  const nums = (o: any) =>
    Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => typeof v === "number")) as Record<string, number>;
  return { age: nums(q.age), gender: nums(q.gender) };
}

/** Geohash heatmap cells (coordinates + affinity, no names) grouped into US metros. */
function normHeatmap(json: any): GeoPoint[] | null {
  const h = json?.results?.heatmap;
  if (!Array.isArray(h) || h.length === 0) return null;
  const cells: HeatCell[] = h
    .map((p: any) => ({ lat: Number(p?.location?.latitude), lon: Number(p?.location?.longitude), affinity: Number(p?.query?.affinity ?? 0) }))
    .filter((c: HeatCell) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && Number.isFinite(c.affinity));
  const metros = metrosFromCells(cells);
  return metros.length ? metros : null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---- client ---------------------------------------------------------------

export class TasteClient {
  readonly mode: DataMode;
  readonly stats: ClientStats = { apiCalls: 0, cachedCalls: 0, errors: 0 };

  constructor(
    private readonly budget: number = Number.POSITIVE_INFINITY,
    mode: DataMode = dataMode(),
  ) {
    this.mode = mode;
  }

  /** Cached GET against the Qloo API, returning a normalised value. */
  private async get<T>(path: string, params: Record<string, string | number | undefined>, normalise: (json: unknown) => T): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const url = `${config.qloo.baseUrl}${path}?${qs.toString()}`;
    const key = `q:${NORM_VERSION}:${hashKey(url)}`;
    const hit = await cacheGet<T>(key);
    if (hit !== undefined) {
      this.stats.cachedCalls++;
      return hit;
    }
    if (this.stats.apiCalls >= this.budget) throw new BudgetExceededError(this.budget);
    const apiKey = process.env.QLOO_API_KEY;
    if (!apiKey) throw new QlooError("QLOO_API_KEY is not configured", 401, "QLOO_AUTH");
    this.stats.apiCalls++;
    try {
      const json = await qlooGate.run(() =>
        withRetry(
          async () => {
            const res = await fetchWithTimeout(url, { headers: { "X-Api-Key": apiKey, Accept: "application/json" }, cache: "no-store" }, config.qloo.timeoutMs);
            const left = Number(res.headers.get("x-month-ratelimit-remaining"));
            if (res.headers.has("x-month-ratelimit-remaining") && Number.isFinite(left)) monthlyRemaining = left;
            const text = await res.text();
            if (!res.ok) throw new HttpError(`Qloo ${res.status}`, res.status, text.slice(0, 300));
            return JSON.parse(text) as unknown;
          },
          { retries: config.qloo.maxRetries, baseMs: 400 },
        ),
      );
      const value = normalise(json);
      await cacheSet(key, value, config.cache.apiTtlSec);
      return value;
    } catch (err) {
      this.stats.errors++;
      if (err instanceof HttpError) {
        if (err.status === 401) throw new QlooError("The Qloo API rejected the key (401).", 401, "QLOO_AUTH");
        if (err.status === 403) throw new QlooError("This entity type or parameter isn't available with the hackathon key (403).", 403, "QLOO_FORBIDDEN");
        if (err.status === 429) throw new QlooError("Qloo rate limit reached (429). Try again shortly.", 429, "QLOO_RATE_LIMIT");
        throw new QlooError(`Qloo request failed (${err.status}).`, err.status, "QLOO_HTTP");
      }
      throw err;
    }
  }

  private async simulate<T>(fn: () => T): Promise<T> {
    if (this.stats.apiCalls >= this.budget) throw new BudgetExceededError(this.budget);
    this.stats.apiCalls++;
    // Small fake latency so the trace behaves like the live API.
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
    return fn();
  }

  async searchPodcasts(query: string, take = 8): Promise<PodcastEntity[]> {
    if (this.mode === "sample") return this.simulate(() => sample.sampleSearchPodcasts(query, take));
    return this.get("/search", { query, types: "urn:entity:podcast", take }, (json) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insightsEntities(json).map((e: any, i: number) => toPodcast(normEntity(e, i + 1))),
    );
  }

  async searchBrands(query: string, take = 3): Promise<BrandEntity[]> {
    if (this.mode === "sample") return this.simulate(() => sample.sampleSearchBrands(query, take));
    return this.get("/search", { query, types: "urn:entity:brand", take }, (json) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insightsEntities(json).map((e: any, i: number) => toBrand(normEntity(e, i + 1), e?.properties)),
    );
  }

  async getPodcast(id: string, nameHint?: string): Promise<PodcastEntity | undefined> {
    if (this.mode === "sample") return this.simulate(() => sample.sampleGetPodcast(id));
    try {
      const viaEntities = await this.get("/entities", { entity_ids: id }, (json) => {
        const e = insightsEntities(json)[0];
        return e ? toPodcast(normEntity(e)) : null;
      });
      if (viaEntities) return viaEntities;
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err;
    }
    if (nameHint) {
      const hits = await this.searchPodcasts(nameHint, 10);
      return hits.find((h) => h.id === id) ?? undefined;
    }
    return undefined;
  }

  /** Top entities in one domain for the audience of `signalId`. */
  async domainProfile(signalId: string, domain: DomainKey, take = 40): Promise<TasteEntity[]> {
    if (this.mode === "sample") return this.simulate(() => sample.sampleInsights({ domain, signalId, take }));
    const params: Record<string, string | number | undefined> = {
      "filter.type": DOMAINS[domain].qlooType,
      "signal.interests.entities": signalId,
      take,
    };
    // Food & drink is a brand domain: place results cluster around one city, brands are national.
    if (domain === "dining") params["filter.tags"] = process.env.QLOO_DINING_TAG || "urn:tag:genre:brand:food_and_beverage";
    // Same-type domains would otherwise list the signal itself.
    if (domain === "podcasts" || domain === "dining") params["filter.exclude.entities"] = signalId;
    return this.get("/v2/insights", params, (json) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insightsEntities(json).map((e: any, i: number) => normEntity(e, i + 1)),
    );
  }

  /** Affinity-ranked brands for the audience of `signalId`. */
  async brandCandidates(signalId: string, take = 50): Promise<BrandEntity[]> {
    if (this.mode === "sample") return this.simulate(() => sample.sampleInsights({ domain: "brands", signalId, take }) as BrandEntity[]);
    return this.get("/v2/insights", { "filter.type": "urn:entity:brand", "signal.interests.entities": signalId, take }, (json) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insightsEntities(json).map((e: any, i: number) => toBrand(normEntity(e, i + 1), e?.properties)),
    );
  }

  /** Affinity of specific brands for the audience of `signalId`. */
  async brandAffinities(signalId: string, brandIds: string[]): Promise<BrandEntity[]> {
    if (brandIds.length === 0) return [];
    if (this.mode === "sample") return this.simulate(() => sample.sampleInsights({ domain: "brands", signalId, take: brandIds.length, onlyIds: brandIds }) as BrandEntity[]);
    return this.get(
      "/v2/insights",
      { "filter.type": "urn:entity:brand", "signal.interests.entities": signalId, "filter.results.entities": brandIds.join(","), take: Math.min(50, brandIds.length) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json) => insightsEntities(json).map((e: any, i: number) => toBrand(normEntity(e, i + 1), e?.properties)),
    );
  }

  /** Podcasts whose listeners love `brandId` (brand-side mode). */
  async podcastsForBrand(brandId: string, take = 20): Promise<PodcastEntity[]> {
    if (this.mode === "sample") return this.simulate(() => sample.sampleSearchPodcasts("", take));
    return this.get("/v2/insights", { "filter.type": "urn:entity:podcast", "signal.interests.entities": brandId, take }, (json) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insightsEntities(json).map((e: any, i: number) => toPodcast(normEntity(e, i + 1))),
    );
  }

  async demographics(signalId: string): Promise<Demographics | null> {
    if (this.mode === "sample") return this.simulate(() => sample.sampleDemographics(signalId));
    return this.get("/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": signalId }, normDemographics);
  }

  async geography(signalId: string): Promise<GeoPoint[] | null> {
    if (this.mode === "sample") return this.simulate(() => sample.sampleGeography(signalId));
    // The heatmap needs a location; geohash cells are the only boundary that stays
    // small (a locality boundary returns every city with its outline polygon).
    return this.get(
      "/v2/insights",
      {
        "filter.type": "urn:heatmap",
        "signal.interests.entities": signalId,
        "filter.location.query": process.env.QLOO_HEATMAP_LOCATION || "United States",
        "output.heatmap.boundary": "urn:geohash",
      },
      normHeatmap,
    );
  }

  /** Safety category known from fixtures (sample mode only). */
  sampleSafety(brandId: string) {
    return this.mode === "sample" ? sample.sampleBrandSafety(brandId) : undefined;
  }
}

export function exampleShowsForMode(mode: DataMode): PodcastEntity[] {
  return mode === "sample" ? sample.sampleExampleShows() : [];
}
