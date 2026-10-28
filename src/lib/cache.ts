// Runtime cache: in-memory LRU, plus an optional Redis-compatible KV over REST
// (Upstash / Vercel KV env vars). Nothing is ever written to the repo.
import "server-only";
import { config } from "./config";

interface Entry {
  value: string;
  expires: number;
}

const MAX_ENTRIES = 2000;
const mem = new Map<string, Entry>();

function memGet(key: string): string | undefined {
  const e = mem.get(key);
  if (!e) return undefined;
  if (e.expires < Date.now()) {
    mem.delete(key);
    return undefined;
  }
  // refresh LRU position
  mem.delete(key);
  mem.set(key, e);
  return e.value;
}

function memSet(key: string, value: string, ttlSec: number) {
  mem.set(key, { value, expires: Date.now() + ttlSec * 1000 });
  while (mem.size > MAX_ENTRIES) {
    const oldest = mem.keys().next().value;
    if (oldest === undefined) break;
    mem.delete(oldest);
  }
}

const kvEnabled = () => Boolean(config.cache.kvUrl && config.cache.kvToken);

async function kv(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(config.cache.kvUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.cache.kvToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  const json = (await res.json()) as { result?: unknown };
  return json.result;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const hit = memGet(key);
  if (hit !== undefined) return JSON.parse(hit) as T;
  if (!kvEnabled()) return undefined;
  try {
    const v = await kv(["GET", `hr:${key}`]);
    if (typeof v !== "string") return undefined;
    memSet(key, v, 300);
    return JSON.parse(v) as T;
  } catch {
    return undefined;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const s = JSON.stringify(value);
  memSet(key, s, ttlSec);
  if (!kvEnabled()) return;
  try {
    await kv(["SET", `hr:${key}`, s, "EX", ttlSec]);
  } catch {
    // KV is best effort; memory cache still holds the value.
  }
}

/** Atomic-ish counter used by rate limiting. Returns the new count. */
export async function incrWithTtl(key: string, ttlSec: number): Promise<number> {
  if (kvEnabled()) {
    try {
      const n = Number(await kv(["INCR", `hr:rl:${key}`]));
      if (n === 1) await kv(["EXPIRE", `hr:rl:${key}`, ttlSec]);
      return n;
    } catch {
      // fall through to memory
    }
  }
  const k = `rl:${key}`;
  const cur = memGet(k);
  const n = (cur ? Number(JSON.parse(cur)) : 0) + 1;
  const existing = mem.get(k);
  const remaining = existing ? Math.max(1, Math.round((existing.expires - Date.now()) / 1000)) : ttlSec;
  memSet(k, JSON.stringify(n), remaining);
  return n;
}

export async function peekCounter(key: string): Promise<number> {
  if (kvEnabled()) {
    try {
      return Number((await kv(["GET", `hr:rl:${key}`])) ?? 0);
    } catch {
      // fall through
    }
  }
  const cur = memGet(`rl:${key}`);
  return cur ? Number(JSON.parse(cur)) : 0;
}

export function hashKey(s: string): string {
  // FNV-1a 64-bit-ish (two 32-bit lanes); good enough for cache keys.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}
