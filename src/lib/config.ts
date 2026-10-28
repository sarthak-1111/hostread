// Server-side configuration. Everything comes from env vars so the hosted demo
// can switch data source or LLM endpoint without code changes.

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export type DataMode = "live" | "sample";

export function dataMode(): DataMode {
  const explicit = (process.env.QLOO_MODE ?? "").toLowerCase();
  if (explicit === "sample") return "sample";
  if (explicit === "live") return "live";
  // Auto: live only when a key is configured.
  return process.env.QLOO_API_KEY ? "live" : "sample";
}

export const config = {
  qloo: {
    baseUrl: process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com",
    timeoutMs: num("QLOO_TIMEOUT_MS", 10_000),
    maxConcurrency: num("QLOO_MAX_CONCURRENCY", 4),
    maxRetries: num("QLOO_MAX_RETRIES", 2),
  },
  llm: {
    baseUrl: (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, ""),
    model: process.env.LLM_MODEL || "gpt-oss:120b",
    // Ollama ignores the key; hosted endpoints need it.
    apiKey: process.env.LLM_API_KEY || "",
    timeoutMs: num("LLM_TIMEOUT_MS", 120_000),
    maxConcurrency: num("LLM_MAX_CONCURRENCY", 1),
    reasoningEffort: process.env.LLM_REASONING_EFFORT || "low",
    temperature: num("LLM_TEMPERATURE", 0.4),
  },
  agent: {
    maxSteps: num("AGENT_MAX_STEPS", 12),
    maxApiCalls: num("AGENT_MAX_API_CALLS", 80),
    runTimeoutMs: num("AGENT_RUN_TIMEOUT_MS", 240_000),
    deepDiveBrands: num("AGENT_DEEP_DIVE_BRANDS", 8),
    pitchesUpFront: num("AGENT_PITCHES_UP_FRONT", 3),
  },
  limits: {
    runsPerIpPer10Min: num("RATE_RUNS_PER_IP_10MIN", 6),
    runsPerIpPerDay: num("RATE_RUNS_PER_IP_DAY", 25),
    globalRunsPerDay: num("RATE_GLOBAL_RUNS_DAY", 150),
    // Fresh runs stop when Qloo reports fewer monthly calls left than this (~60 calls a run).
    qlooMonthlyReserve: num("QLOO_MONTHLY_RESERVE", 2500),
    searchesPerIpPerMin: num("RATE_SEARCH_PER_IP_MIN", 90),
    pitchesPerIpPer10Min: num("RATE_PITCH_PER_IP_10MIN", 20),
  },
  run: {
    // inline: run inside the web server process; the browser polls the job log.
    // stream: same, but the start request itself streams the job's events back
    // (serverless hosts with long streaming functions, such as Vercel).
    // background: hand each run to a Netlify background function, because
    // regular functions there stop after 60 s.
    execution: (["background", "stream"].includes(process.env.RUN_EXECUTION ?? "") ? process.env.RUN_EXECUTION : "inline") as "inline" | "stream" | "background",
    jobSecret: process.env.JOB_SECRET || "",
  },
  cache: {
    // memory | kv | blobs; unset = kv when KV credentials exist, else memory.
    backend: process.env.CACHE_BACKEND || "",
    apiTtlSec: num("CACHE_API_TTL_SEC", 60 * 60 * 24 * 7),
    runTtlSec: num("CACHE_RUN_TTL_SEC", 60 * 60 * 24 * 14),
    kvUrl: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
    kvToken: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
  },
} as const;

/** Bump to invalidate cached runs after scoring / prompt changes. */
export const RUN_VERSION = "v1";

export function llmLabel(): string {
  // The hosted demo sets LLM_LABEL so the page doesn't advertise the endpoint host.
  if (process.env.LLM_LABEL) return process.env.LLM_LABEL;
  try {
    const host = new URL(config.llm.baseUrl).host;
    return `${config.llm.model} @ ${host}`;
  } catch {
    return config.llm.model;
  }
}
