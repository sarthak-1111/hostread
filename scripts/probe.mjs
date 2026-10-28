// API verification probe for the Qloo hackathon key.
//
//   node --env-file=.env.local scripts/probe.mjs
//
// Prints a SUMMARY (counts, names, field shapes, latency, headers) — never
// raw payloads — and writes the same summary to probe-output/ (gitignored).
// Keeps the request count modest: ~70 calls, max 4 in flight.
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY;
if (!KEY) {
  console.error("QLOO_API_KEY is not set (put it in .env.local).");
  process.exit(1);
}

const log = [];
const out = (...a) => {
  const line = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  log.push(line);
  console.log(line);
};

let inflight = 0;
const queue = [];
async function gate(fn) {
  if (inflight >= 4) await new Promise((r) => queue.push(r));
  inflight++;
  try {
    return await fn();
  } finally {
    inflight--;
    queue.shift()?.();
  }
}

const timings = [];
async function get(path, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
  return gate(async () => {
    const t0 = performance.now();
    const res = await fetch(url, { headers: { "X-Api-Key": KEY, Accept: "application/json" } });
    const ms = Math.round(performance.now() - t0);
    timings.push(ms);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    const rl = {};
    for (const [k, v] of res.headers) if (/rate|limit|retry|quota/i.test(k)) rl[k] = v;
    return { status: res.status, ms, json, err: res.ok ? undefined : text.slice(0, 200), rl };
  });
}

const ents = (j) => (Array.isArray(j?.results?.entities) ? j.results.entities : Array.isArray(j?.results) ? j.results : []);
const keys = (o) => (o && typeof o === "object" ? Object.keys(o).sort() : []);
const brief = (e) => ({
  name: e?.name,
  id: e?.entity_id ?? e?.id,
  type: e?.subtype ?? e?.types ?? e?.type,
  aff: e?.query?.affinity !== undefined ? Number(e.query.affinity).toFixed(3) : undefined,
  pop: e?.popularity !== undefined ? Number(e.popularity).toFixed(3) : undefined,
});

const summary = { base: BASE, at: new Date().toISOString(), sections: {} };

// 1) podcast resolution
const SHOWS = [
  ["news", "The Daily"],
  ["news", "Up First"],
  ["business", "How I Built This"],
  ["business", "Acquired"],
  ["comedy", "SmartLess"],
  ["comedy", "Conan O'Brien Needs a Friend"],
  ["true crime", "Crime Junkie"],
  ["true crime", "Serial"],
  ["sports", "The Bill Simmons Podcast"],
  ["sports", "Pardon My Take"],
  ["health", "Huberman Lab"],
  ["health", "The Mel Robbins Podcast"],
];
out("\n== 1. /search podcasts ==");
const resolved = [];
const s1 = await Promise.all(SHOWS.map(([genre, q]) => get("/search", { query: q, types: "urn:entity:podcast", take: 5 }).then((r) => ({ genre, q, r }))));
for (const { genre, q, r } of s1) {
  const list = ents(r.json);
  const exact = list.find((e) => (e.name ?? "").toLowerCase() === q.toLowerCase());
  out(`[${r.status} ${r.ms}ms] ${genre.padEnd(10)} "${q}" -> ${list.length} hits; top: ${list.slice(0, 3).map((e) => e.name).join(" | ")}${exact ? "  (exact match)" : ""}`);
  if (r.err) out("   error:", r.err);
  if (list[0]) resolved.push({ genre, q, top: brief(exact ?? list[0]), exact: !!exact });
}
summary.sections.search = resolved;
const firstHit = ents(s1.find((x) => ents(x.r.json).length)?.r.json)[0];
if (firstHit) {
  out("search result keys:", keys(firstHit));
  out("properties keys:", keys(firstHit.properties));
  out("tag example:", firstHit.tags?.[0] ? keys(firstHit.tags[0]) : "none", firstHit.tags?.slice(0, 4).map((t) => `${t.type ?? t.subtype}:${t.name}`));
}

const podcasts = resolved.filter((r) => r.exact).map((r) => r.top);
if (!podcasts.length) {
  out("\nNo exact podcast matches — podcast coverage looks thin. Stop here and report.");
  finish();
}

// 2) brands for podcast audiences
out("\n== 2. /v2/insights brands with a podcast signal ==");
const brandRuns = await Promise.all(
  podcasts.slice(0, 4).map((p) => get("/v2/insights", { "filter.type": "urn:entity:brand", "signal.interests.entities": p.id, take: 25 }).then((r) => ({ p, r }))),
);
summary.sections.brands = [];
for (const { p, r } of brandRuns) {
  const list = ents(r.json);
  out(`[${r.status} ${r.ms}ms] ${p.name}: ${list.length} brands; top 10:`, list.slice(0, 10).map((e) => `${e.name} (${e.query?.affinity?.toFixed?.(3)})`).join(", "));
  if (r.err) out("   error:", r.err);
  const affs = list.map((e) => e.query?.affinity).filter((x) => typeof x === "number");
  summary.sections.brands.push({ podcast: p.name, count: list.length, top: list.slice(0, 10).map(brief), affinityRange: affs.length ? [Math.min(...affs), Math.max(...affs)] : null });
}
const b0 = ents(brandRuns[0]?.r.json)[0];
if (b0) {
  out("brand keys:", keys(b0), "query keys:", keys(b0.query), "properties keys:", keys(b0.properties));
  const tagTypes = {};
  for (const e of ents(brandRuns[0].r.json)) for (const t of e.tags ?? []) tagTypes[t.type ?? t.subtype ?? "?"] = (tagTypes[t.type ?? t.subtype ?? "?"] ?? 0) + 1;
  out("brand tag types:", tagTypes);
  out("brand tags sample:", (b0.tags ?? []).slice(0, 8).map((t) => `${t.type ?? t.subtype}:${t.name}`));
  summary.sections.brandTagTypes = tagTypes;
}

// 3) other domains for one podcast
out("\n== 3. other domains (podcast signal) ==");
const P = podcasts[0];
const DOMAINS = [
  ["artist", { "filter.type": "urn:entity:artist" }],
  ["movie", { "filter.type": "urn:entity:movie" }],
  ["tv_show", { "filter.type": "urn:entity:tv_show" }],
  ["book", { "filter.type": "urn:entity:book" }],
  ["podcast", { "filter.type": "urn:entity:podcast" }],
  ["destination", { "filter.type": "urn:entity:destination" }],
  ["place (any)", { "filter.type": "urn:entity:place" }],
  ["place (restaurant tag)", { "filter.type": "urn:entity:place", "filter.tags": "urn:tag:category:place:restaurant" }],
];
summary.sections.domains = [];
for (const [label, params] of DOMAINS) {
  const r = await get("/v2/insights", { ...params, "signal.interests.entities": P.id, take: 10 });
  const list = ents(r.json);
  out(`[${r.status} ${r.ms}ms] ${label.padEnd(24)} ${list.length} results: ${list.slice(0, 4).map((e) => e.name).join(" | ")}`);
  if (r.err) out("   error:", r.err);
  if (list[0]) out("   properties keys:", keys(list[0].properties).slice(0, 25).join(","));
  summary.sections.domains.push({ label, status: r.status, count: list.length, sample: list.slice(0, 4).map((e) => e.name) });
}
// place tag discovery: which category tags do top places carry?
{
  const r = await get("/v2/insights", { "filter.type": "urn:entity:place", "signal.interests.entities": P.id, take: 15 });
  const cats = {};
  for (const e of ents(r.json)) for (const t of e.tags ?? []) if (/category/.test(t.type ?? t.subtype ?? "")) cats[`${t.tag_id ?? t.id} = ${t.name}`] = (cats[`${t.tag_id ?? t.id} = ${t.name}`] ?? 0) + 1;
  out("place category tags seen:", Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 12));
}
const tagSearch = await get("/v2/tags", { "filter.query": "restaurant", take: 10 });
out(`[${tagSearch.status}] /v2/tags filter.query=restaurant:`, (tagSearch.json?.results?.tags ?? ents(tagSearch.json)).slice?.(0, 8).map((t) => `${t.id ?? t.tag_id} (${t.type ?? t.subtype ?? ""})`));

// 4) brand as signal
out("\n== 4. brand fans (brand signal) ==");
if (b0) {
  const bid = b0.entity_id;
  for (const t of ["urn:entity:movie", "urn:entity:artist", "urn:entity:book"]) {
    const r = await get("/v2/insights", { "filter.type": t, "signal.interests.entities": bid, take: 10 });
    out(`[${r.status} ${r.ms}ms] fans of ${b0.name} -> ${t}: ${ents(r.json).slice(0, 4).map((e) => e.name).join(" | ")}`);
  }
}

// 5) demographics, heatmap, explainability, entities, filter.results.entities
out("\n== 5. demographics / heatmap / explainability / entities ==");
{
  const r = await get("/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": P.id });
  out(`[${r.status} ${r.ms}ms] demographics: results keys`, keys(r.json?.results), r.err ?? "");
  const d = r.json?.results?.demographics;
  const q = Array.isArray(d) ? d[0]?.query : d?.query;
  out("   demographics.query:", q ? { age: q.age, gender: q.gender } : "none");
  summary.sections.demographics = { status: r.status, shape: q ? { age: keys(q.age), gender: keys(q.gender) } : null };
}
for (const boundary of [undefined, "city", "neighborhood"]) {
  const params = { "filter.type": "urn:heatmap", "signal.interests.entities": P.id, take: 10 };
  if (boundary) params["output.heatmap.boundary"] = boundary;
  const r = await get("/v2/insights", params);
  const h = r.json?.results?.heatmap;
  out(`[${r.status} ${r.ms}ms] heatmap boundary=${boundary ?? "default"}: ${Array.isArray(h) ? h.length : 0} points; first keys`, h?.[0] ? { top: keys(h[0]), location: keys(h[0].location), query: keys(h[0].query) } : r.err ?? "none");
  if (h?.[0]?.location) out("   first location:", h[0].location);
}
{
  const r = await get("/v2/insights", { "filter.type": "urn:entity:brand", "signal.interests.entities": P.id, "feature.explainability": "true", take: 3 });
  const e = ents(r.json)[0];
  out(`[${r.status} ${r.ms}ms] explainability: entity query keys`, keys(e?.query), "top-level query keys", keys(r.json?.query));
  if (e?.query?.explainability) out("   explainability sample:", JSON.stringify(e.query.explainability).slice(0, 300));
}
{
  const r = await get("/entities", { entity_ids: P.id });
  out(`[${r.status} ${r.ms}ms] /entities?entity_ids=: ${ents(r.json).length} results`, r.err ?? "");
}
if (b0) {
  const ids = ents(brandRuns[0].r.json).slice(5, 8).map((e) => e.entity_id).join(",");
  const r = await get("/v2/insights", { "filter.type": "urn:entity:brand", "signal.interests.entities": P.id, "filter.results.entities": ids, take: 3 });
  out(`[${r.status} ${r.ms}ms] filter.results.entities (3 ids) -> ${ents(r.json).length}:`, ents(r.json).map((e) => `${e.name} ${e.query?.affinity?.toFixed?.(3)}`));
}
{
  const r = await get("/search", { query: "Squarespace", types: "urn:entity:brand", take: 3 });
  out(`[${r.status} ${r.ms}ms] /search brand "Squarespace":`, ents(r.json).map((e) => e.name));
}

// 6) latency + a small burst to look for rate-limit behaviour
out("\n== 6. latency & small burst ==");
const burst = await Promise.all(Array.from({ length: 8 }, (_, i) => get("/search", { query: ["jazz", "pizza", "tokyo", "comedy", "running", "coffee", "horror", "sneakers"][i], types: "urn:entity:brand", take: 1 })));
out("burst statuses:", burst.map((b) => b.status).join(","), "rate headers:", burst[0].rl);
const sorted = [...timings].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
summary.sections.latency = { calls: timings.length, p50: pct(50), p90: pct(90), max: sorted.at(-1) };
out("latency:", summary.sections.latency);

finish();

function finish() {
  mkdirSync("probe-output", { recursive: true });
  writeFileSync("probe-output/summary.json", JSON.stringify(summary, null, 2));
  writeFileSync("probe-output/probe.log", log.join("\n"));
  out("\nWrote probe-output/summary.json and probe.log (gitignored).");
  process.exit(0);
}
