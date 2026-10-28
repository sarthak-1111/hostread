// Runtime cache: an in-memory LRU in front of an optional shared store —
// Netlify Blobs on Netlify, or a Redis-compatible KV over REST (Upstash /
// Vercel KV). Nothing is ever written to the repo.
import { getStore } from "@netlify/blobs";
import { config } from "./config";

interface Entry {
  value: string;
  expires: number;
}

const MAX_ENTRIES = 2000;
// On globalThis so every route bundle (and dev hot reloads) share one map.
const g = globalThis as typeof globalThis & { __hostreadMem?: Map<string, Entry> };
const mem = (g.__hostreadMem ??= new Map<string, Entry>());

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

/** A store shared by every server instance. */
interface SharedStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  /** Write only if the key is absent or expired. Returns whether it wrote. */
  create(key: string, value: string, ttlSec: number): Promise<boolean>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSec: number): Promise<number>;
}

// ---- Redis-compatible KV over REST -------------------------------------------

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

const kvStore: SharedStore = {
  async get(key) {
    const v = await kv(["GET", `hr:${key}`]);
    return typeof v === "string" ? v : undefined;
  },
  async set(key, value, ttlSec) {
    await kv(["SET", `hr:${key}`, value, "EX", ttlSec]);
  },
  async create(key, value, ttlSec) {
    return (await kv(["SET", `hr:${key}`, value, "NX", "EX", ttlSec])) === "OK";
  },
  async del(key) {
    await kv(["DEL", `hr:${key}`]);
  },
  async incr(key, ttlSec) {
    const n = Number(await kv(["INCR", `hr:${key}`]));
    if (n === 1) await kv(["EXPIRE", `hr:${key}`, ttlSec]);
    return n;
  },
};

// ---- Netlify Blobs -------------------------------------------------------------
// Blobs have no TTL, so each value is boxed with its expiry time.

interface Boxed {
  v: string;
  e: number;
}

let blobStore: ReturnType<typeof getStore> | undefined;
const blobs = () => (blobStore ??= getStore({ name: "hostread", consistency: "strong" }));

async function blobGet(key: string): Promise<Boxed | undefined> {
  const b = (await blobs().get(key, { type: "json" })) as Boxed | null;
  return b && b.e > Date.now() ? b : undefined;
}

const blobStoreShared: SharedStore = {
  async get(key) {
    return (await blobGet(key))?.v;
  },
  async set(key, value, ttlSec) {
    await blobs().setJSON(key, { v: value, e: Date.now() + ttlSec * 1000 } satisfies Boxed);
  },
  async create(key, value, ttlSec) {
    const boxed: Boxed = { v: value, e: Date.now() + ttlSec * 1000 };
    if ((await blobs().setJSON(key, boxed, { onlyIfNew: true })).modified) return true;
    // Present: take it over only if it has expired, and only if nobody else did first.
    const cur = await blobs().getWithMetadata(key, { type: "json" });
    if (!cur) return (await blobs().setJSON(key, boxed, { onlyIfNew: true })).modified;
    if ((cur.data as Boxed).e > Date.now()) return false;
    if (cur.etag) return (await blobs().setJSON(key, boxed, { onlyIfMatch: cur.etag })).modified;
    await blobs().delete(key);
    return (await blobs().setJSON(key, boxed, { onlyIfNew: true })).modified;
  },
  async del(key) {
    await blobs().delete(key);
  },
  async incr(key, ttlSec) {
    // Read-modify-write: good enough for soft rate limits, not for money.
    const cur = await blobGet(key);
    const n = (cur ? Number(cur.v) || 0 : 0) + 1;
    await blobs().setJSON(key, { v: String(n), e: cur?.e ?? Date.now() + ttlSec * 1000 } satisfies Boxed);
    return n;
  },
};

function shared(): SharedStore | undefined {
  const b = config.cache.backend;
  if (b === "blobs") return blobStoreShared;
  if (b === "memory") return undefined;
  return config.cache.kvUrl && config.cache.kvToken ? kvStore : undefined;
}

export const hasSharedStore = () => shared() !== undefined;

// ---- cache API -------------------------------------------------------------------

/** Read-through cache for API responses and finished runs. */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const hit = memGet(key);
  if (hit !== undefined) return JSON.parse(hit) as T;
  const store = shared();
  if (!store) return undefined;
  try {
    const v = await store.get(key);
    if (v === undefined) return undefined;
    memSet(key, v, 300);
    return JSON.parse(v) as T;
  } catch {
    return undefined;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const s = JSON.stringify(value);
  memSet(key, s, ttlSec);
  try {
    await shared()?.set(key, s, ttlSec);
  } catch {
    // The shared store is best effort; the memory cache still holds the value.
  }
}

// Live state (job logs, in-flight markers) skips the memory layer so every
// instance sees the latest write. Without a shared store it lives in memory.

export async function sharedGet<T>(key: string): Promise<T | undefined> {
  const store = shared();
  const v = store ? await store.get(key) : memGet(key);
  return v === undefined ? undefined : (JSON.parse(v) as T);
}

export async function sharedSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const s = JSON.stringify(value);
  const store = shared();
  if (store) await store.set(key, s, ttlSec);
  else memSet(key, s, ttlSec);
}

export async function sharedCreate(key: string, value: unknown, ttlSec: number): Promise<boolean> {
  const s = JSON.stringify(value);
  const store = shared();
  if (store) return store.create(key, s, ttlSec);
  if (memGet(key) !== undefined) return false;
  memSet(key, s, ttlSec);
  return true;
}

export async function sharedDelete(key: string): Promise<void> {
  const store = shared();
  if (store) await store.del(key);
  else mem.delete(key);
}

/** Counter used by rate limiting. Returns the new count. */
export async function incrWithTtl(key: string, ttlSec: number): Promise<number> {
  const store = shared();
  if (store) {
    try {
      return await store.incr(`rl:${key}`, ttlSec);
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
  const store = shared();
  if (store) {
    try {
      return Number((await store.get(`rl:${key}`)) ?? 0);
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
