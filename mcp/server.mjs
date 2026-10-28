#!/usr/bin/env node
// HostRead MCP server (stdio). Lets any MCP client (Claude Desktop, Claude Code,
// other agents) use HostRead as a tool. It calls the hosted HostRead API and
// holds no keys: Qloo and the LLM stay on the server, behind its rate limits.
//
//   HOSTREAD_URL  HostRead deployment to call (default https://hostread.vercel.app)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.HOSTREAD_URL || "https://hostread.vercel.app").replace(/\/+$/, "");
const HEADERS = { "User-Agent": "hostread-mcp/1.0", Accept: "application/json, application/x-ndjson" };
/** A fresh sponsor deck takes 1 to 2 minutes; give up well after the server would. */
const RUN_TIMEOUT_MS = 330_000;

class HostReadError extends Error {}

async function getJson(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...HEADERS, ...init.headers }, signal: init.signal ?? AbortSignal.timeout(90_000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new HostReadError(json.error ?? `HostRead answered ${res.status}`);
  return json;
}

const text = (s) => ({ content: [{ type: "text", text: s }] });
const fail = (err) => ({ isError: true, ...text(err instanceof HostReadError ? err.message : `HostRead is unreachable right now (${err?.message ?? err}).`) });
const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")).toString();
const aff = (x) => (typeof x === "number" ? x.toFixed(2) : "n/a");
const DOMAIN = { film: "Film", tv: "TV", music: "Music", dining: "Food & drink", books: "Book", travel: "Place", podcasts: "Podcast" };
const chips = (list) => list.map((e) => `${DOMAIN[e.domain] ?? e.domain}: ${e.entity.name}`).join("; ");

/** Send an MCP progress notification when the client asked for them. */
function progress(extra) {
  const token = extra?._meta?.progressToken;
  let n = 0;
  return async (message) => {
    if (token === undefined) return;
    await extra.sendNotification({ method: "notifications/progress", params: { progressToken: token, progress: ++n, message } }).catch(() => undefined);
  };
}

/** Start (or join) a sponsor-deck run and wait for the finished deck. */
async function runDeck(params, onStep) {
  const signal = AbortSignal.timeout(RUN_TIMEOUT_MS);
  const res = await fetch(`${BASE}/api/run?${qs(params)}`, { method: "POST", headers: HEADERS, signal });
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("ndjson")) {
    // Stream mode: one run event per line until "done".
    const decoder = new TextDecoder();
    let buf = "";
    for await (const chunk of res.body) {
      buf += decoder.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        const e = JSON.parse(line);
        if (e.type === "done") return { result: e.result, cached: false };
        if (e.type === "error") throw new HostReadError(e.message);
        if (e.type === "step" && e.step.status === "running") await onStep(e.step.title);
      }
    }
    throw new HostReadError("The analysis stream ended early. Please try again.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new HostReadError(json.error ?? `HostRead answered ${res.status}`);
  if (json.result) return { result: json.result, cached: Boolean(json.cached) };
  // Inline / background mode: poll the job log.
  let from = 0;
  while (!signal.aborted) {
    const log = await getJson(`/api/run/events?${qs({ job: json.jobId, from })}`);
    for (const e of log.events) {
      if (e.type === "done") return { result: e.result, cached: false };
      if (e.type === "error") throw new HostReadError(e.message);
      if (e.type === "step" && e.step.status === "running") await onStep(e.step.title);
    }
    from = log.next;
    if (log.stale) throw new HostReadError("The analysis stopped responding. Please try again.");
    await new Promise((r) => setTimeout(r, json.pollMs ?? 1000));
  }
  throw new HostReadError("The analysis took too long.");
}

function formatDeck(r, cached) {
  const url = `${BASE}/show/${encodeURIComponent(r.podcast.id)}?${qs({ name: r.podcast.name })}`;
  const out = [
    `# Sponsor deck: ${r.podcast.name}`,
    `${r.mode === "live" ? "Live Qloo data" : "SAMPLE data (synthetic, not Qloo output)"}${cached ? ", from cache" : ""}. Podcast ID: ${r.podcast.id}`,
    `Open it: ${url}`,
    "",
    "Fit = 100 × (0.50·A + 0.35·O + 0.15·S): A = Qloo affinity among the listeners, O = taste overlap with the brand's fans, S = 1 when a plain LLM didn't suggest the brand. Fit is a relative ranking within this deck, not a revenue prediction.",
  ];
  if (r.agentSummary) out.push("", `Audience: ${r.agentSummary}`);
  for (const c of r.deck) {
    out.push(
      "",
      `## ${c.rank}. ${c.brand.name}${c.brand.category ? ` (${c.brand.category})` : ""}: fit ${c.fit}${c.surpriseFit ? " [Surprise fit]" : ""}`,
      `Brand ID ${c.brand.id}. A ${c.score.affinity.toFixed(2)}, O ${c.score.overlap.toFixed(2)}, S ${c.score.surprise}, Qloo affinity ${aff(c.score.rawAffinity)}.`,
      c.topEvidence.length ? `Listeners and the brand's fans both love: ${chips(c.topEvidence)}.` : "No shared favourites above 0.75; the pick rests on affinity.",
    );
    if (c.pitch) out.push(`Pitch email subject: ${c.pitch.subject}`, "", c.pitch.email, "", `Host-read ad script (${c.pitch.adWords} words, about ${c.pitch.adSeconds} s):`, "", c.pitch.adScript);
  }
  if (r.baseline?.available && r.baseline.picks.length)
    out.push("", `A plain LLM, given only the show's name and topic, suggested: ${r.baseline.picks.map((p) => p.name).join(", ")}.`);
  return out.join("\n");
}

function formatMatches(r, cached) {
  const url = `${BASE}/brands/match?${qs({ id: r.brand.id, name: r.brand.name })}`;
  const out = [
    `# Podcasts whose listeners love ${r.brand.name}`,
    `${r.mode === "live" ? "Live Qloo data" : "SAMPLE data (synthetic, not Qloo output)"}${cached ? ", from cache" : ""}. Brand ID: ${r.brand.id}`,
    `Open it: ${url}`,
    "",
    `Fit = 100 × (0.60·A + 0.40·O): A = Qloo affinity of the podcast among the brand's fans, O = how much the listeners love the fans' top 20 films, shows, artists, books and food brands. Relative ranking within this shortlist, not a reach prediction.`,
  ];
  for (const m of r.matches) {
    out.push(
      "",
      `## ${m.rank}. ${m.podcast.name}: fit ${m.fit}`,
      `Podcast ID ${m.podcast.id}${m.podcast.genres?.length ? `, ${m.podcast.genres.join(", ")}` : ""}. A ${m.score.affinity.toFixed(2)}, O ${m.score.overlap.toFixed(2)}, Qloo affinity ${aff(m.score.rawAffinity)}.`,
      m.topEvidence.length ? `Fans and listeners both love: ${chips(m.topEvidence)}.` : "No shared favourites above 0.75.",
    );
  }
  if (r.more?.length) out.push("", `Also high affinity (no overlap check): ${r.more.map((p) => p.name).join(", ")}.`);
  return out.join("\n");
}

const server = new McpServer({ name: "hostread", version: "1.0.0" });

server.registerTool(
  "search_podcasts",
  {
    title: "Search podcasts",
    description: "Find podcasts in the Qloo taste graph by name. Returns podcast IDs for sponsor_deck.",
    inputSchema: { query: z.string().min(2).max(80).describe("Podcast name, e.g. 'Crime Junkie'") },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ query }) => {
    try {
      const { results = [] } = await getJson(`/api/search?${qs({ q: query })}`);
      if (!results.length) return text(`No podcasts found for "${query}".`);
      return text(results.map((p) => `- ${p.name} (ID ${p.id})${p.subtitle ? `: ${p.subtitle}` : ""}`).join("\n"));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "search_brands",
  {
    title: "Search brands",
    description: "Find brands in the Qloo taste graph by name. Returns brand IDs for podcasts_for_brand.",
    inputSchema: { query: z.string().min(2).max(80).describe("Brand name, e.g. 'Allbirds'") },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ query }) => {
    try {
      const { results = [] } = await getJson(`/api/search?${qs({ q: query, type: "brand" })}`);
      if (!results.length) return text(`No brands found for "${query}".`);
      return text(results.map((b) => `- ${b.name} (ID ${b.id})${b.subtitle ? `: ${b.subtitle}` : ""}`).join("\n"));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "sponsor_deck",
  {
    title: "Sponsor deck for a podcast",
    description:
      "Rank the brands a podcast's listeners already love, with fit scores, the shared tastes behind each, and a grounded pitch email and host-read ad script for the top brands. Cached shows return instantly; a new show takes 1 to 2 minutes.",
    inputSchema: {
      podcast_id: z.string().max(160).optional().describe("Qloo podcast ID from search_podcasts (preferred)"),
      podcast_name: z.string().max(160).optional().describe("Podcast name, used when no ID is given"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ podcast_id, podcast_name }, extra) => {
    if (!podcast_id && !podcast_name) return fail(new HostReadError("Give a podcast_id or a podcast_name."));
    try {
      const { result, cached } = await runDeck(podcast_id ? { id: podcast_id, name: podcast_name } : { q: podcast_name }, progress(extra));
      return text(formatDeck(result, cached));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "write_pitch",
  {
    title: "Write a pitch for one brand",
    description: "Write the pitch email and 45-60 s host-read ad script for one brand in a podcast's deck. References come only from Qloo taste data and are checked in code.",
    inputSchema: {
      podcast_id: z.string().min(1).max(160).describe("Qloo podcast ID"),
      brand_id: z.string().min(1).max(160).describe("Qloo brand ID from the sponsor deck"),
      podcast_name: z.string().max(160).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ podcast_id, brand_id, podcast_name }) => {
    try {
      const { pitch } = await getJson("/api/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podcastId: podcast_id, brandId: brand_id, name: podcast_name }),
      });
      return text([`Subject: ${pitch.subject}`, "", pitch.email, "", `Host-read ad script (${pitch.adWords} words, about ${pitch.adSeconds} s):`, "", pitch.adScript].join("\n"));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "podcasts_for_brand",
  {
    title: "Podcasts for a brand",
    description: "Rank the podcasts whose listeners already love a brand, with fit scores and the tastes both audiences share. Deterministic, no LLM; about 10 to 20 seconds when not cached.",
    inputSchema: {
      brand_id: z.string().max(160).optional().describe("Qloo brand ID from search_brands (preferred)"),
      brand_name: z.string().max(80).optional().describe("Brand name, used when no ID is given"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ brand_id, brand_name }) => {
    if (!brand_id && !brand_name) return fail(new HostReadError("Give a brand_id or a brand_name."));
    try {
      const { result, cached } = await getJson(`/api/brand?${qs(brand_id ? { id: brand_id, name: brand_name } : { q: brand_name })}`);
      return text(formatMatches(result, cached));
    } catch (err) {
      return fail(err);
    }
  },
);

await server.connect(new StdioServerTransport());
