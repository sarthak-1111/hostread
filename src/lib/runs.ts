// Run manager: result cache (memory / KV) and in-flight de-duplication, so
// repeat demos are instant and three judges clicking the same example share
// one run instead of starting three.
import "server-only";
import { RUN_VERSION, config, dataMode } from "./config";
import { cacheGet, cacheSet, hashKey } from "./cache";
import { executeRun, type RunInput } from "./agent/run";
import { normName } from "./names";
import type { RunEvent, RunResult } from "./types";

interface Inflight {
  events: RunEvent[];
  listeners: Set<(e: RunEvent) => void>;
  done: boolean;
}

const inflight = new Map<string, Inflight>();

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

export function isInflight(key: string): boolean {
  return inflight.has(key);
}

/** Start a run for `key`, or join the one already running. Returns an unsubscribe fn. */
export function startOrJoin(key: string, input: RunInput, listener: (e: RunEvent) => void): () => void {
  let run = inflight.get(key);
  if (!run) {
    const created: Inflight = { events: [], listeners: new Set(), done: false };
    run = created;
    inflight.set(key, created);
    const ctrl = new AbortController();
    const hardStop = setTimeout(() => ctrl.abort(), config.agent.runTimeoutMs + 30_000);
    const runId = key.split(":").pop()!.slice(0, 10);
    const dispatch = (e: RunEvent) => {
      created.events.push(e);
      for (const l of created.listeners) l(e);
    };
    void (async () => {
      // Save the result BEFORE telling clients we're done: serverless hosts may
      // freeze the function as soon as the response stream closes.
      let saved: Promise<void> | undefined;
      const emit = (e: RunEvent) => {
        if (e.type === "done") {
          saved = saveRun(key, e.result)
            .catch(() => undefined)
            .then(() => dispatch(e));
          return;
        }
        dispatch(e);
      };
      try {
        await executeRun(input, emit, ctrl.signal, runId);
      } catch (err) {
        dispatch({ type: "error", message: err instanceof Error ? err.message : "Run failed" });
      } finally {
        if (saved) await saved;
        clearTimeout(hardStop);
        created.done = true;
        inflight.delete(key);
        created.listeners.clear();
      }
    })();
  } else {
    for (const e of run.events) listener(e);
  }
  run.listeners.add(listener);
  return () => run!.listeners.delete(listener);
}
