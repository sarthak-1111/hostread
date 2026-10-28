// Run manager: result cache, in-flight de-duplication and job logs.
//
// A run is a job. Whoever executes it (this server process, or a Netlify
// background function) appends its events to a job log in the shared store;
// the browser polls that log. Repeat demos come straight from the result
// cache, and three judges clicking the same example share one job.
import { RUN_VERSION, config, dataMode } from "./config";
import { cacheGet, cacheSet, hasSharedStore, hashKey, sharedCreate, sharedDelete, sharedGet, sharedSet } from "./cache";
import { executeRun, type RunInput } from "./agent/run";
import { normName } from "./names";
import type { RunEvent, RunResult } from "./types";

export interface JobRequest {
  jobId: string;
  key: string;
  input: RunInput;
}

export interface JobLog {
  events: RunEvent[];
  done: boolean;
  /** Last write; the runner writes at least every HEARTBEAT_MS. */
  at: number;
}

interface InflightMarker {
  jobId: string;
  at: number;
}

const JOB_TTL_SEC = 60 * 60;
const HEARTBEAT_MS = 15_000;
/** A job log older than this that isn't done belongs to a runner that died. */
export const STALE_MS = 75_000;
const inflightTtlSec = () => Math.ceil((config.agent.runTimeoutMs + 60_000) / 1000);
const jobKey = (jobId: string) => `job:${jobId}`;
const inflightKey = (key: string) => `inflight:${key}`;

export function runKey(input: RunInput): string {
  const subject = input.podcastId ? `id:${input.podcastId}` : `q:${normName(input.query ?? input.nameHint ?? "")}`;
  return `run:${RUN_VERSION}:${dataMode()}:${hashKey(`${subject}|${input.exclude.join(",")}`)}`;
}

export async function getCachedRun(key: string): Promise<RunResult | undefined> {
  return cacheGet<RunResult>(key);
}

export async function saveRun(key: string, result: RunResult): Promise<void> {
  await cacheSet(key, result, config.cache.runTtlSec);
}

export function isJobId(s: string): boolean {
  return /^[a-z0-9]{12}$/.test(s);
}

export async function readJob(jobId: string): Promise<JobLog | undefined> {
  return sharedGet<JobLog>(jobKey(jobId));
}

/** The job currently running for `key`, if any. */
export async function currentJob(key: string): Promise<string | undefined> {
  return (await sharedGet<InflightMarker>(inflightKey(key)))?.jobId;
}

/**
 * Start a job for `key`, or join the one that won the race to start it.
 * `origin` is this site's URL, used to reach the background function.
 */
export async function startJob(key: string, input: RunInput, origin: string): Promise<{ jobId: string; joined: boolean }> {
  const jobId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  if (!(await sharedCreate(inflightKey(key), { jobId, at: Date.now() } satisfies InflightMarker, inflightTtlSec()))) {
    const other = await currentJob(key);
    if (other) return { jobId: other, joined: true };
  }
  // Seed the log so the first poll finds the job.
  await sharedSet(jobKey(jobId), { events: [], done: false, at: Date.now() } satisfies JobLog, JOB_TTL_SEC);

  if (config.run.execution === "inline") {
    void runJob({ jobId, key, input });
    return { jobId, joined: false };
  }
  try {
    const res = await fetch(`${origin}/.netlify/functions/agent-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-HostRead-Job": config.run.jobSecret },
      body: JSON.stringify({ jobId, key, input } satisfies JobRequest),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`background function answered ${res.status}`);
  } catch (err) {
    await sharedDelete(inflightKey(key)).catch(() => undefined);
    throw err;
  }
  return { jobId, joined: false };
}

/** Execute one job, writing its events to the job log as they happen. */
export async function runJob({ jobId, key, input }: JobRequest): Promise<void> {
  const log: JobLog = { events: [], done: false, at: Date.now() };
  let dirty = true;
  let queued = false;
  let chain: Promise<void> = Promise.resolve();
  // Writes are serialised; each one sends the whole log as it is at write time.
  const flush = () => {
    if (queued) return chain;
    queued = true;
    dirty = false;
    chain = chain.then(async () => {
      queued = false;
      log.at = Date.now();
      await sharedSet(jobKey(jobId), log, JOB_TTL_SEC).catch(() => undefined);
    });
    return chain;
  };
  // A shared store costs a request per write, so batch; memory is free.
  const flushMs = hasSharedStore() ? 900 : 200;
  let lastWrite = Date.now();
  const timer = setInterval(() => {
    if (dirty || Date.now() - lastWrite > HEARTBEAT_MS) {
      lastWrite = Date.now();
      void flush();
    }
  }, flushMs);

  const ctrl = new AbortController();
  const hardStop = setTimeout(() => ctrl.abort(), config.agent.runTimeoutMs + 30_000);
  let saved: Promise<void> | undefined;
  const push = (e: RunEvent) => {
    log.events.push(e);
    dirty = true;
  };
  const emit = (e: RunEvent) => {
    // Cache the result BEFORE publishing "done", so a reload right after the
    // deck appears is served from cache instead of starting a new run.
    if (e.type === "done") {
      saved = saveRun(key, e.result)
        .catch(() => undefined)
        .then(() => push(e));
      return;
    }
    push(e);
  };
  try {
    await executeRun(input, emit, ctrl.signal, jobId);
  } catch (err) {
    push({ type: "error", message: err instanceof Error ? err.message : "Run failed" });
  } finally {
    if (saved) await saved;
    clearTimeout(hardStop);
    clearInterval(timer);
    log.done = true;
    dirty = true;
    await flush();
    if ((await currentJob(key).catch(() => undefined)) === jobId) await sharedDelete(inflightKey(key)).catch(() => undefined);
  }
}
