// Run manager: result cache, in-flight de-duplication and job logs.
//
// A run is a job. Whoever executes it (this server process, or a Netlify
// background function) appends its events to a job log in the shared store;
// the browser polls that log, or in stream mode reads it through the start
// request. Repeat demos come straight from the result cache, and three judges
// clicking the same example share one job.
import { get as blobGet, put as blobPut } from "@vercel/blob";
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

// Deck archive: on Vercel, function instances don't share memory, so finished
// decks are also written to a private Vercel Blob store (BLOB_READ_WRITE_TOKEN).
// Private server-side caching is what Qloo's terms allow; reads are authenticated
// with the same token and keyed by the hashed run key.
const hasDeckArchive = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const deckPath = (key: string) => `decks/${key.replace(/:/g, "/")}.json`;
const ARCHIVE_TIMEOUT_MS = 5000;

async function readArchived<T extends { createdAt: string }>(key: string): Promise<T | undefined> {
  const res = await blobGet(deckPath(key), { access: "private", abortSignal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS) });
  if (!res?.stream) return undefined;
  const deck = JSON.parse(await new Response(res.stream).text()) as T;
  const ageMs = Date.now() - Date.parse(deck.createdAt);
  return ageMs < config.cache.runTtlSec * 1000 ? deck : undefined;
}

/** A finished result (sponsor deck or brand match) from memory, else the archive. */
export async function getCachedResult<T extends { createdAt: string }>(key: string): Promise<T | undefined> {
  const hit = await cacheGet<T>(key);
  if (hit || !hasDeckArchive()) return hit;
  const archived = await readArchived<T>(key).catch(() => undefined);
  if (archived) await cacheSet(key, archived, config.cache.runTtlSec);
  return archived;
}

export function getCachedRun(key: string): Promise<RunResult | undefined> {
  return getCachedResult<RunResult>(key);
}

export function saveRun(key: string, result: RunResult): Promise<void> {
  return saveResult(key, result);
}

export async function saveResult(key: string, result: { createdAt: string }): Promise<void> {
  await cacheSet(key, result, config.cache.runTtlSec);
  if (!hasDeckArchive()) return;
  await blobPut(deckPath(key), JSON.stringify(result), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    abortSignal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS),
  }).catch(() => undefined);
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
export async function startJob(key: string, input: RunInput, origin: string): Promise<{ jobId: string; joined: boolean; running?: Promise<void> }> {
  const jobId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  if (!(await sharedCreate(inflightKey(key), { jobId, at: Date.now() } satisfies InflightMarker, inflightTtlSec()))) {
    const other = await currentJob(key);
    if (other) return { jobId: other, joined: true };
  }
  // Seed the log so the first poll finds the job.
  await sharedSet(jobKey(jobId), { events: [], done: false, at: Date.now() } satisfies JobLog, JOB_TTL_SEC);

  if (config.run.execution !== "background") {
    // The caller keeps the function alive until this settles (see after() in the route).
    const running = runJob({ jobId, key, input });
    return { jobId, joined: false, running };
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

const encoder = new TextEncoder();

/**
 * A job's events as an NDJSON stream, one RunEvent per line, ending after the
 * run's last event. Sends a ping line when quiet so proxies keep the
 * connection open.
 */
export function streamJob(jobId: string, signal: AbortSignal): ReadableStream<Uint8Array> {
  const pollMs = hasSharedStore() ? 900 : 250;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let from = 0;
      let misses = 0;
      let lastSend = Date.now();
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        lastSend = Date.now();
      };
      try {
        while (!signal.aborted) {
          const log = await readJob(jobId).catch(() => undefined);
          if (log) {
            for (const e of log.events.slice(from)) send(e);
            from = log.events.length;
            if (log.done) break;
            if (Date.now() - log.at > STALE_MS) {
              send({ type: "error", message: "The analysis stopped responding. Please re-run it." } satisfies RunEvent);
              break;
            }
          } else if (++misses * pollMs > 20_000) {
            send({ type: "error", message: "The analysis didn't start. Please try again." } satisfies RunEvent);
            break;
          }
          if (Date.now() - lastSend > 10_000) send({ type: "ping" });
          await new Promise((r) => setTimeout(r, pollMs));
        }
      } catch {
        // The client went away; the job itself keeps running.
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
}
