// SAMPLE MODE FIXTURES — SYNTHETIC DATA, NOT QLOO OUTPUT.
//
// Everything in this file is generated in code from fictional names and a
// made-up "taste cluster" model, so the UI, agent loop and scoring can be
// built before a Qloo key exists. Shows, brands, films, artists, food brands
// and books here are invented. Every entity is flagged `sample: true` and the
// UI shows a SAMPLE DATA banner whenever this module is in use.
//
// The output shapes match the normalised shapes the live client produces.

import type { BrandEntity, Demographics, DomainKey, GeoPoint, PodcastEntity, TasteEntity } from "../types";
import { DOMAINS } from "../domains";
import type { SafetyCategory } from "../types";

// 12 invented taste clusters.
const CLUSTERS = [
  "indie", "prestige", "outdoors", "foodie", "gamer", "noir",
  "sports", "wellness", "hustle", "comedy", "literary", "family",
] as const;
type Cluster = (typeof CLUSTERS)[number];
type Vec = Partial<Record<Cluster, number>>;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (const k of CLUSTERS) s += (a[k] ?? 0) * (b[k] ?? 0);
  return s;
}

function norm(v: Vec): Vec {
  const len = Math.sqrt(dot(v, v)) || 1;
  const out: Vec = {};
  for (const k of CLUSTERS) if (v[k]) out[k] = (v[k] as number) / len;
  return out;
}

interface SampleShow {
  id: string;
  name: string;
  genres: string[];
  description: string;
  vec: Vec;
  popularity: number;
}

interface SampleBrand {
  id: string;
  name: string;
  category: string;
  safety?: SafetyCategory;
  vec: Vec;
  popularity: number;
}

const SHOWS: SampleShow[] = [
  { name: "Ledger & Lattice", genres: ["Business", "Investing"], description: "Weekly interviews with founders and operators about building durable companies.", vec: { hustle: 1, gamer: 0.2, literary: 0.4, wellness: 0.25, prestige: 0.2 }, popularity: 0.82 },
  { name: "Crosstalk Cabaret", genres: ["Comedy", "Improv"], description: "Three comedians, one terrible premise, no editing.", vec: { comedy: 1, gamer: 0.4, sports: 0.3, foodie: 0.3, indie: 0.2 }, popularity: 0.88 },
  { name: "The Cold Index", genres: ["True Crime", "Investigative"], description: "Long-form investigations into cases the headlines forgot.", vec: { noir: 1, prestige: 0.6, literary: 0.4, family: 0.25 }, popularity: 0.9 },
  { name: "Box Score Supper Club", genres: ["Sports", "Basketball"], description: "Two former beat writers argue about basketball and where to eat on road trips.", vec: { sports: 1, foodie: 0.35, comedy: 0.4, hustle: 0.2 }, popularity: 0.76 },
  { name: "Dispatch at Dawn", genres: ["News", "Politics"], description: "A 20-minute morning briefing with one deep story a day.", vec: { literary: 0.75, prestige: 0.5, hustle: 0.4, indie: 0.3 }, popularity: 0.85 },
  { name: "Steady Pulse", genres: ["Health", "Fitness"], description: "Evidence-first conversations about training, sleep and nutrition.", vec: { wellness: 1, outdoors: 0.6, foodie: 0.35, family: 0.3 }, popularity: 0.8 },
  { name: "Patch Notes After Dark", genres: ["Gaming", "Technology"], description: "Late-night chat about indie games, hardware and internet culture.", vec: { gamer: 1, comedy: 0.5, indie: 0.35, noir: 0.1 }, popularity: 0.7 },
  { name: "Field & Ferment", genres: ["Food", "Culture"], description: "Farmers, chefs and fermenters on where flavour comes from.", vec: { foodie: 1, outdoors: 0.4, indie: 0.45, wellness: 0.3 }, popularity: 0.62 },
].map((s) => ({ ...s, id: `sample-podcast-${hash(s.name).toString(36)}`, vec: norm(s.vec) }));

const BRAND_SEED: Omit<SampleBrand, "id">[] = [
  { name: "Kettlecraft Coffee", category: "Coffee", vec: { foodie: 0.8, hustle: 0.4, indie: 0.35 }, popularity: 0.7 },
  { name: "Northfold Oat Milk", category: "Food & Drink", vec: { wellness: 0.6, foodie: 0.5, indie: 0.3 }, popularity: 0.6 },
  { name: "Brightpan Meal Kits", category: "Meal Kits", vec: { family: 0.6, foodie: 0.6, wellness: 0.2 }, popularity: 0.75 },
  { name: "Saltmarsh Hot Sauce", category: "Food & Drink", vec: { foodie: 0.9, comedy: 0.3, sports: 0.3 }, popularity: 0.45 },
  { name: "Cinder Pizza Ovens", category: "Home & Kitchen", vec: { foodie: 0.7, outdoors: 0.45, family: 0.2 }, popularity: 0.5 },
  { name: "Ridgeline Outfitters", category: "Outdoor Apparel", vec: { outdoors: 1, wellness: 0.25 }, popularity: 0.72 },
  { name: "Loomwell Basics", category: "Apparel", vec: { hustle: 0.4, indie: 0.35, wellness: 0.2 }, popularity: 0.65 },
  { name: "Fieldnote Denim", category: "Apparel", vec: { indie: 0.6, foodie: 0.25, outdoors: 0.2 }, popularity: 0.48 },
  { name: "Courtline Sneakers", category: "Footwear", vec: { sports: 0.9, comedy: 0.4 }, popularity: 0.8 },
  { name: "Driftwell Mattress", category: "Sleep", vec: { wellness: 0.6, family: 0.5, hustle: 0.2 }, popularity: 0.78 },
  { name: "Hearth & Hue Candles", category: "Home", vec: { family: 0.6, literary: 0.35, indie: 0.2 }, popularity: 0.42 },
  { name: "Lumen Desk Co.", category: "Workspace", vec: { gamer: 0.5, hustle: 0.6 }, popularity: 0.5 },
  { name: "Quillstack Notes", category: "Productivity Software", vec: { hustle: 0.7, literary: 0.5 }, popularity: 0.55 },
  { name: "Vaultline VPN", category: "Software", vec: { gamer: 0.8, noir: 0.35, hustle: 0.2 }, popularity: 0.74 },
  { name: "Pixelwick Keyboards", category: "Gaming Hardware", vec: { gamer: 1, indie: 0.2 }, popularity: 0.5 },
  { name: "Orbit Earbuds", category: "Audio", vec: { gamer: 0.4, sports: 0.4, wellness: 0.35 }, popularity: 0.7 },
  { name: "Framehaus Cameras", category: "Photography", vec: { indie: 0.6, outdoors: 0.5, prestige: 0.2 }, popularity: 0.46 },
  { name: "Tally Budget App", category: "Personal Finance", vec: { hustle: 0.8, family: 0.35 }, popularity: 0.6 },
  { name: "Cobalt Card", category: "Fintech", vec: { hustle: 0.7, gamer: 0.35 }, popularity: 0.66 },
  { name: "Copperleaf Investing", category: "Investing", vec: { hustle: 0.9, literary: 0.2 }, popularity: 0.58 },
  { name: "Greenline Greens", category: "Supplements", vec: { wellness: 0.9, hustle: 0.3 }, popularity: 0.7 },
  { name: "Calmcove Meditation", category: "Wellness App", vec: { wellness: 0.8, literary: 0.3 }, popularity: 0.62 },
  { name: "Trailmix Protein Bars", category: "Snacks", vec: { sports: 0.5, outdoors: 0.6, wellness: 0.5 }, popularity: 0.55 },
  { name: "Steadyform Fitness", category: "Fitness", vec: { wellness: 0.7, sports: 0.5 }, popularity: 0.6 },
  { name: "Marginalia Book Club", category: "Books", vec: { literary: 1, prestige: 0.4 }, popularity: 0.4 },
  { name: "Reelhouse Streaming", category: "Streaming", vec: { prestige: 0.8, indie: 0.5, noir: 0.4 }, popularity: 0.68 },
  { name: "Spoolcast Audiobooks", category: "Audiobooks", vec: { literary: 0.8, noir: 0.5 }, popularity: 0.64 },
  { name: "Wayfarer Rail Passes", category: "Travel", vec: { outdoors: 0.5, literary: 0.4, indie: 0.4 }, popularity: 0.38 },
  { name: "Harborlight Hotels", category: "Hotels", vec: { foodie: 0.5, prestige: 0.4, hustle: 0.2 }, popularity: 0.57 },
  { name: "Pawprint Kibble", category: "Pets", vec: { family: 0.7, outdoors: 0.3 }, popularity: 0.6 },
  { name: "Dicebox Board Games", category: "Games", vec: { gamer: 0.7, family: 0.5, comedy: 0.3 }, popularity: 0.44 },
  { name: "Sentrybell Doorbells", category: "Home Security", vec: { family: 0.6, noir: 0.5 }, popularity: 0.63 },
  { name: "Fernway Skincare", category: "Skincare", vec: { wellness: 0.6, indie: 0.3 }, popularity: 0.59 },
  { name: "Tidepool Swimwear", category: "Apparel", vec: { outdoors: 0.5, comedy: 0.3, wellness: 0.2 }, popularity: 0.4 },
  { name: "Grain & Gable Bakery Box", category: "Food & Drink", vec: { foodie: 0.8, family: 0.3 }, popularity: 0.36 },
  { name: "Kitestring Kids", category: "Kids Apparel", vec: { family: 0.9 }, popularity: 0.5 },
  { name: "Clearpath Languages", category: "Education", vec: { literary: 0.5, outdoors: 0.3, hustle: 0.3 }, popularity: 0.52 },
  { name: "Brassline Watches", category: "Accessories", vec: { prestige: 0.6, hustle: 0.5 }, popularity: 0.47 },
  { name: "Novaform Standing Desks", category: "Workspace", vec: { hustle: 0.5, gamer: 0.5, wellness: 0.3 }, popularity: 0.45 },
  { name: "Fable & Fern Plants", category: "Home", vec: { indie: 0.5, wellness: 0.4, family: 0.3 }, popularity: 0.41 },
  { name: "Sundial Sunglasses", category: "Accessories", vec: { outdoors: 0.5, sports: 0.4, comedy: 0.3 }, popularity: 0.5 },
  { name: "Inkwell Mystery Box", category: "Subscription Box", vec: { noir: 0.8, literary: 0.5, family: 0.2 }, popularity: 0.33 },
  { name: "Old Ferry Bourbon", category: "Spirits", safety: "alcohol", vec: { prestige: 0.5, noir: 0.5, foodie: 0.3 }, popularity: 0.55 },
  { name: "Hopworks Hazy IPA", category: "Beer", safety: "alcohol", vec: { sports: 0.6, comedy: 0.5 }, popularity: 0.6 },
  { name: "Vineyard Atlas Wine Club", category: "Wine", safety: "alcohol", vec: { foodie: 0.7, literary: 0.3 }, popularity: 0.5 },
  { name: "ParlayPal Sportsbook", category: "Sports Betting", safety: "gambling", vec: { sports: 1, comedy: 0.3 }, popularity: 0.7 },
  { name: "LuckyLark Casino", category: "Online Casino", safety: "gambling", vec: { comedy: 0.5, noir: 0.2 }, popularity: 0.5 },
  { name: "Mellowleaf CBD", category: "CBD", safety: "cannabis", vec: { wellness: 0.5, indie: 0.4 }, popularity: 0.45 },
  { name: "Cloudline Vapor", category: "Vaping", safety: "tobacco", vec: { comedy: 0.4, gamer: 0.3 }, popularity: 0.42 },
  { name: "Summit Coin Exchange", category: "Crypto Exchange", safety: "crypto", vec: { hustle: 0.7, gamer: 0.6 }, popularity: 0.5 },
];

const BRANDS: SampleBrand[] = BRAND_SEED.map((b) => ({ ...b, id: `sample-brand-${hash(b.name).toString(36)}`, vec: norm(b.vec) }));

// ---- fictional cultural entities, generated combinatorially -------------

const WORDS = {
  adj: ["Quiet", "Velvet", "Northern", "Paper", "Electric", "Hollow", "Golden", "Last", "Salt", "Silver", "Wild", "Midnight", "Lantern", "Borrowed", "Copper", "Glass", "Distant", "Little", "Burning", "Slow"],
  noun: ["Harbor", "Orchard", "Signal", "Lighthouse", "Meridian", "Season", "Archive", "Garden", "River", "Static", "Engine", "Atlas", "Kingdom", "Window", "Comet", "Ledger", "Ferry", "Echo", "Summer", "Frontier"],
  plural: ["Owls", "Tides", "Satellites", "Foxes", "Parades", "Machines", "Ghosts", "Pilots", "Gardens", "Lanterns", "Wolves", "Strangers", "Arcades", "Rivers", "Saints"],
  first: ["June", "Marlow", "Ines", "Theo", "Calla", "Rafe", "Odile", "Bram", "Sunny", "Wren", "Ezra", "Lux", "Nadia", "Otis", "Pia"],
  last: ["Hartley", "Okafor", "Lindqvist", "Moreau", "Castellanos", "Achebe", "Whitlock", "Sato", "Delacroix", "Brennan", "Varga", "Quill", "Abernathy", "Novak", "Ferreira"],
  food: ["Cold Brew", "Granola", "Hot Sauce", "Sparkling Tea", "Pancake Mix", "Kombucha", "Snack Bars", "Coffee Roasters", "Popcorn", "Frozen Yogurt", "Pasta Sauce", "Kettle Chips", "Nut Butter", "Lemonade", "Bakehouse"],
  place: ["Port Ellery", "Lake Morrow", "Calder Bay", "Isle of Venn", "Ashgrove Valley", "Mount Tabora", "Saltcombe", "Bellmere Coast", "Rio Seco", "Kestrel Highlands", "Old Avon Quarter", "Larkspur Springs", "Teller Island", "Vasa Peninsula", "Juniper Flats"],
};

function makeName(domain: DomainKey, r: () => number): string {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  switch (domain) {
    case "film":
      return r() < 0.5 ? `The ${pick(WORDS.adj)} ${pick(WORDS.noun)}` : `${pick(WORDS.noun)} of ${pick(WORDS.plural)}`;
    case "tv":
      return r() < 0.5 ? `${pick(WORDS.adj)} ${pick(WORDS.noun)}` : `The ${pick(WORDS.last)}s`;
    case "music":
      return r() < 0.45 ? `${pick(WORDS.adj)} ${pick(WORDS.plural)}` : `${pick(WORDS.first)} ${pick(WORDS.last)}`;
    case "books":
      return r() < 0.5 ? `The ${pick(WORDS.noun)} ${pick(["Keeper", "Letters", "Year", "Inheritance", "Map", "Daughters"])}` : `A ${pick(WORDS.adj)} ${pick(WORDS.noun)}`;
    case "dining":
      return `${pick(WORDS.first)}'s ${pick(WORDS.food)}`;
    case "travel":
      return pick(WORDS.place);
    case "podcasts":
      return `${pick(WORDS.adj)} ${pick(WORDS.noun)} Radio`;
  }
}

function subtitleFor(domain: DomainKey, r: () => number): string {
  const year = 1995 + Math.floor(r() * 30);
  switch (domain) {
    case "film":
      return `Film · ${year}`;
    case "tv":
      return `TV series · ${year}`;
    case "music":
      return "Artist";
    case "books":
      return `Book · ${year}`;
    case "dining":
      return "Food & drink brand";
    case "travel":
      return "Destination";
    case "podcasts":
      return "Podcast";
  }
}

interface PoolEntity {
  e: TasteEntity;
  vec: Vec;
}

const POOLS = new Map<DomainKey, PoolEntity[]>();

function pool(domain: DomainKey): PoolEntity[] {
  const existing = POOLS.get(domain);
  if (existing) return existing;
  const r = rng(hash(`pool:${domain}`));
  const seen = new Set<string>();
  const out: PoolEntity[] = [];
  let i = 0;
  while (out.length < 72 && i < 2000) {
    i++;
    const name = makeName(domain, r);
    if (seen.has(name)) continue;
    seen.add(name);
    const primary = CLUSTERS[out.length % CLUSTERS.length];
    const secondary = CLUSTERS[Math.floor(r() * CLUSTERS.length)];
    const vec: Vec = { [primary]: 1 };
    vec[secondary] = (vec[secondary] ?? 0) + 0.3 + r() * 0.4;
    out.push({
      vec: norm(vec),
      e: {
        id: `sample-${domain}-${hash(name).toString(36)}`,
        name,
        type: DOMAINS[domain].qlooType,
        popularity: Math.round((0.3 + r() * 0.7) * 100) / 100,
        subtitle: subtitleFor(domain, r),
        sample: true,
      },
    });
  }
  POOLS.set(domain, out);
  return out;
}

function vecForSignal(id: string): Vec | undefined {
  return SHOWS.find((s) => s.id === id)?.vec ?? BRANDS.find((b) => b.id === id)?.vec;
}

/** Rank-based affinity in a believable 0.55..0.99 range. */
function affinityForRank(rank: number, total: number): number {
  return Math.round((0.99 - (0.44 * (rank - 1)) / Math.max(1, total - 1)) * 1000) / 1000;
}

function rankBy<T>(items: T[], score: (t: T) => number, take: number): { item: T; score: number }[] {
  return items
    .map((item) => ({ item, score: score(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, take);
}

// ---- public sample API (mirrors the live client) -------------------------

export function sampleSearchPodcasts(query: string, take = 8): PodcastEntity[] {
  const q = query.trim().toLowerCase();
  const hits = SHOWS.filter((s) => !q || s.name.toLowerCase().includes(q) || s.genres.some((g) => g.toLowerCase().includes(q)));
  return hits.slice(0, take).map(showToEntity);
}

export function sampleExampleShows(): PodcastEntity[] {
  return SHOWS.slice(0, 6).map(showToEntity);
}

function showToEntity(s: SampleShow): PodcastEntity {
  return {
    id: s.id,
    name: s.name,
    type: "urn:entity:podcast",
    popularity: s.popularity,
    subtitle: s.genres.join(" · "),
    description: s.description,
    genres: s.genres,
    tags: s.genres.map((g) => ({ id: `sample-tag-${g.toLowerCase()}`, name: g, type: "urn:tag:genre:podcast" })),
    sample: true,
  };
}

export function sampleGetPodcast(id: string): PodcastEntity | undefined {
  const s = SHOWS.find((x) => x.id === id);
  return s ? showToEntity(s) : undefined;
}

function brandToEntity(b: SampleBrand): BrandEntity {
  return {
    id: b.id,
    name: b.name,
    type: "urn:entity:brand",
    popularity: b.popularity,
    category: b.category,
    group: b.category,
    subtitle: b.category,
    tags: [{ id: `sample-tag-${b.category.toLowerCase().replace(/\W+/g, "-")}`, name: b.category, type: "urn:tag:category:brand" }],
    sample: true,
  };
}

export function sampleSearchBrands(query: string, take = 5): BrandEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return BRANDS.filter((b) => b.name.toLowerCase().includes(q) || q.includes(b.name.toLowerCase().split(" ")[0]))
    .slice(0, take)
    .map(brandToEntity);
}

export function sampleExampleBrands(): BrandEntity[] {
  return BRANDS.filter((b) => !b.safety).slice(0, 5).map(brandToEntity);
}

export function sampleGetBrand(id: string): BrandEntity | undefined {
  const b = BRANDS.find((x) => x.id === id);
  return b ? brandToEntity(b) : undefined;
}

/** Shows ranked by how much a brand's fans would like them (brand-side mode). */
export function samplePodcastsForBrand(brandId: string, take = 20): PodcastEntity[] {
  const sig = vecForSignal(brandId);
  if (!sig) return [];
  const noise = (id: string) => rng(hash(`${brandId}|${id}`))() - 0.5;
  const ranked = rankBy(SHOWS, (s) => dot(sig, s.vec) + 0.1 * s.popularity + 0.2 * noise(s.id), take);
  return ranked.map(({ item }, i) => ({ ...showToEntity(item), rank: i + 1, affinity: affinityForRank(i + 1, ranked.length) }));
}

export function sampleBrandSafety(id: string): SafetyCategory | undefined {
  return BRANDS.find((b) => b.id === id)?.safety;
}

export function sampleInsights(opts: {
  domain: DomainKey | "brands";
  signalId: string;
  take: number;
  onlyIds?: string[];
  excludeIds?: string[];
}): TasteEntity[] {
  const sig = vecForSignal(opts.signalId);
  if (!sig) return [];
  const noise = (id: string) => rng(hash(`${opts.signalId}|${id}`))() - 0.5;
  if (opts.domain === "brands") {
    let brands = BRANDS.filter((b) => b.id !== opts.signalId);
    if (opts.onlyIds) brands = brands.filter((b) => opts.onlyIds!.includes(b.id));
    if (opts.excludeIds) brands = brands.filter((b) => !opts.excludeIds!.includes(b.id));
    const ranked = rankBy(brands, (b) => dot(sig, b.vec) + 0.12 * b.popularity + 0.18 * noise(b.id), opts.onlyIds ? brands.length : opts.take);
    const total = opts.onlyIds ? BRANDS.length : ranked.length;
    // For explicit lookups, affinity reflects where the brand would rank overall.
    const full = opts.onlyIds ? rankBy(BRANDS.filter((b) => b.id !== opts.signalId), (b) => dot(sig, b.vec) + 0.12 * b.popularity + 0.18 * noise(b.id), BRANDS.length) : ranked;
    return ranked.map(({ item }, i) => {
      const overallRank = full.findIndex((x) => x.item.id === item.id) + 1;
      return { ...brandToEntity(item), rank: i + 1, affinity: affinityForRank(opts.onlyIds ? overallRank : i + 1, total) };
    });
  }
  const p = pool(opts.domain);
  const scoreOf = (x: PoolEntity) => dot(sig, x.vec) + 0.1 * (x.e.popularity ?? 0) + 0.25 * noise(x.e.id);
  if (opts.onlyIds) {
    // Explicit lookups: affinity reflects where each item would rank in the whole pool.
    const full = rankBy(p, scoreOf, p.length);
    return full
      .map(({ item }, i) => ({ item, overall: i + 1 }))
      .filter(({ item }) => opts.onlyIds!.includes(item.e.id))
      .map(({ item, overall }, i) => ({ ...item.e, rank: i + 1, affinity: affinityForRank(overall, p.length) }));
  }
  const ranked = rankBy(p, scoreOf, opts.take);
  return ranked.map(({ item }, i) => ({ ...item.e, rank: i + 1, affinity: affinityForRank(i + 1, ranked.length) }));
}

export function sampleDemographics(signalId: string): Demographics | null {
  const v = vecForSignal(signalId);
  if (!v) return null;
  const g = (k: Cluster) => v[k] ?? 0;
  const young = g("gamer") * 0.6 + g("comedy") * 0.4 + g("indie") * 0.3 - g("family") * 0.3 - g("literary") * 0.2;
  const mid = g("hustle") * 0.4 + g("wellness") * 0.3 + g("family") * 0.4 + g("foodie") * 0.2;
  const older = g("literary") * 0.5 + g("prestige") * 0.4 + g("noir") * 0.2 - g("gamer") * 0.4;
  const male = g("sports") * 0.5 + g("gamer") * 0.4 + g("hustle") * 0.2 - g("wellness") * 0.2 - g("noir") * 0.3;
  const clamp = (x: number) => Math.max(-0.6, Math.min(0.6, Math.round(x * 100) / 100));
  return {
    age: {
      "24_and_younger": clamp(young * 0.8 - 0.05),
      "25_to_29": clamp(young * 0.6 + mid * 0.2),
      "30_to_34": clamp(mid * 0.6),
      "35_to_44": clamp(mid * 0.5 + older * 0.1 - 0.05),
      "45_to_54": clamp(older * 0.5 - young * 0.2),
      "55_and_older": clamp(older * 0.6 - young * 0.4 - 0.05),
    },
    gender: { male: clamp(male), female: clamp(-male) },
  };
}

const SAMPLE_CITIES = ["Austin", "Chicago", "Denver", "Portland, OR", "Atlanta", "New York", "Minneapolis", "Nashville", "Columbus", "Kansas City", "Seattle", "Philadelphia"];

export function sampleGeography(signalId: string): GeoPoint[] | null {
  const v = vecForSignal(signalId);
  if (!v) return null;
  const r = rng(hash(`geo:${signalId}`));
  return SAMPLE_CITIES.map((name) => ({ name, affinity: Math.round(r() * 1000) / 1000 }))
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, 6);
}
