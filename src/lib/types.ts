// Shared types used by the server (agent, scoring) and the browser (UI).
// Nothing in here holds raw API payloads: the Qloo client normalises
// responses into these small shapes before anything else sees them.

export type DomainKey = "film" | "tv" | "music" | "dining" | "books" | "travel" | "podcasts";

export interface DomainInfo {
  key: DomainKey;
  label: string;
  /** Qloo filter.type */
  qlooType: string;
  /** Short noun for chips, e.g. "film" in "Listeners also love: <film>". */
  noun: string;
}

export interface Tag {
  id: string;
  name: string;
  type?: string;
}

export interface TasteEntity {
  id: string;
  name: string;
  /** Qloo entity type, e.g. urn:entity:brand */
  type: string;
  /** Qloo query.affinity for the signal used (0..1), if returned. */
  affinity?: number;
  /** 1-based rank in the result list it came from. */
  rank?: number;
  popularity?: number;
  /** One-line context: year, city, author, category … */
  subtitle?: string;
  /** Short description from the entity's properties, if any (truncated). */
  description?: string;
  image?: string;
  tags?: Tag[];
  /** True when this entity comes from the synthetic SAMPLE fixtures. */
  sample?: boolean;
}

export interface PodcastEntity extends TasteEntity {
  genres?: string[];
}

export interface BrandEntity extends TasteEntity {
  category?: string;
  /** Coarse grouping (Qloo brand subtype or genre) used to keep the shortlist varied. */
  group?: string;
}

export interface DomainProfile {
  domain: DomainKey;
  entities: TasteEntity[];
}

export interface Demographics {
  /** Relative skew per age bucket, roughly -1..1 (0 = average). */
  age: Record<string, number>;
  /** Relative skew per gender, roughly -1..1. */
  gender: Record<string, number>;
}

export interface GeoPoint {
  name: string;
  affinity: number;
}

export interface SharedEntity {
  domain: DomainKey;
  entity: TasteEntity;
  /** Rank weight in the listener profile (0..1]. */
  listenerWeight: number;
  /** Rank weight in the brand-fan profile (0..1]. */
  brandWeight: number;
}

export interface OverlapResult {
  brandId: string;
  /** Weighted Jaccard per domain (0..1). */
  perDomain: Partial<Record<DomainKey, number>>;
  /** Mean weighted Jaccard across the domains compared. */
  raw: number;
  shared: SharedEntity[];
}

export interface ScoreBreakdown {
  /** A: audience affinity, normalised within the candidate pool (0..1). */
  affinity: number;
  /** O: taste overlap, normalised within the deck (0..1). */
  overlap: number;
  /** S: 1 if the plain-LLM baseline missed this brand, else 0. */
  surprise: number;
  /** Raw Qloo affinity for reference. */
  rawAffinity?: number;
  /** Raw mean weighted Jaccard for reference. */
  rawOverlap: number;
}

export interface PitchPack {
  subject: string;
  email: string;
  adScript: string;
  /** Allowed references actually cited. */
  references: string[];
  /** How the text was produced. */
  source: "llm" | "template";
  attempts: number;
  /** Words in the ad script and estimated read time in seconds. */
  adWords: number;
  adSeconds: number;
  /** Offending references that forced a rewrite, for transparency. */
  rejected?: string[];
}

export interface SponsorCard {
  rank: number;
  brand: BrandEntity;
  fit: number;
  score: ScoreBreakdown;
  surpriseFit: boolean;
  evidence: SharedEntity[];
  /** Up to three chips, ideally from different domains. */
  topEvidence: SharedEntity[];
  perDomain: Partial<Record<DomainKey, number>>;
  pitch?: PitchPack;
}

/** Brand-side mode: one podcast whose listeners love the brand. */
export interface PodcastMatch {
  rank: number;
  podcast: PodcastEntity;
  fit: number;
  score: {
    /** A: Qloo affinity of the podcast among the brand's fans, normalised across candidates (0..1). */
    affinity: number;
    /** O: taste overlap, normalised within the shortlist (0..1). */
    overlap: number;
    rawAffinity?: number;
    rawOverlap: number;
  };
  /** Brand fans' favourites the listeners also love (listenerWeight / brandWeight are Qloo affinities). */
  evidence: SharedEntity[];
  topEvidence: SharedEntity[];
  perDomain: Partial<Record<DomainKey, number>>;
}

export interface BrandMatchResult {
  matchId: string;
  mode: "live" | "sample";
  createdAt: string;
  brand: BrandEntity;
  /** What the brand's fans love, per overlap domain. */
  fanProfile: DomainProfile[];
  matches: PodcastMatch[];
  /** Further podcasts with high affinity among the brand's fans, not deep-dived. */
  more: PodcastEntity[];
  stats: { apiCalls: number; ms: number; candidates: number };
}

export interface BaselinePick {
  name: string;
  /** Matched Qloo brand, if the name resolved. */
  matched?: BrandEntity;
  /** Qloo affinity of that brand for this show's listeners, if known. */
  affinity?: number;
  /** Percentile of that affinity within the taste-ranked candidates (0..1). */
  percentile?: number;
  /** True when the taste deck also contains this brand. */
  inDeck: boolean;
}

export interface BaselineResult {
  available: boolean;
  picks: BaselinePick[];
  note?: string;
}

export type SafetyCategory =
  | "alcohol"
  | "gambling"
  | "tobacco"
  | "cannabis"
  | "adult"
  | "crypto"
  | "firearms";

export interface RunRequest {
  podcastId?: string;
  query?: string;
  exclude: SafetyCategory[];
}

export interface TraceStep {
  id: string;
  /** Who acted: the LLM agent, the orchestrator guardrails, or a code step. */
  actor: "agent" | "guardrail" | "code" | "llm";
  tool: string;
  title: string;
  params?: Record<string, unknown>;
  status: "running" | "ok" | "error" | "skipped";
  startedAt: number;
  ms?: number;
  /** Short human summary of the result, e.g. "40 films, 40 artists". */
  summary?: string;
  counts?: Record<string, number>;
  apiCalls?: number;
  cached?: boolean;
  /** Agent's stated reason for the call, when it gave one. */
  thought?: string;
}

export interface RunResult {
  runId: string;
  mode: "live" | "sample";
  llm: string;
  createdAt: string;
  podcast: PodcastEntity;
  profile: DomainProfile[];
  demographics?: Demographics | null;
  geography?: GeoPoint[] | null;
  deck: SponsorCard[];
  baseline: BaselineResult;
  excluded: SafetyCategory[];
  /** Brands removed by brand-safety toggles. */
  filteredOut: { name: string; category: SafetyCategory }[];
  agentSummary?: string;
  stats: {
    apiCalls: number;
    llmCalls: number;
    /** Prompt + completion tokens reported by the LLM endpoint (0 if not reported). */
    llmTokens?: number;
    ms: number;
    steps: number;
    fallbacks: string[];
  };
  trace: TraceStep[];
}

export type RunEvent =
  | { type: "meta"; mode: "live" | "sample"; llm: string; runId: string; cached: boolean }
  | { type: "step"; step: TraceStep }
  | { type: "podcast"; podcast: PodcastEntity }
  | { type: "profile"; profile: DomainProfile[] }
  | { type: "demographics"; demographics: Demographics | null }
  | { type: "geography"; geography: GeoPoint[] | null }
  | { type: "candidates"; count: number }
  | { type: "deck"; deck: SponsorCard[]; filteredOut: RunResult["filteredOut"] }
  | { type: "baseline"; baseline: BaselineResult }
  | { type: "pitch"; brandId: string; pitch: PitchPack }
  | { type: "summary"; text: string }
  | { type: "done"; result: RunResult }
  | { type: "error"; message: string; code?: string };
