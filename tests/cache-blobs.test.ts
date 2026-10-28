// The Netlify Blobs backend of the shared store, against the local Blobs
// server that ships with @netlify/blobs.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BlobsServer } from "@netlify/blobs/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "hostread-blobs-"));
const token = "test-token";
let server: BlobsServer;
let cache: typeof import("@/lib/cache");

beforeAll(async () => {
  server = new BlobsServer({ directory: dir, token, port: 0 });
  const { port } = await server.start();
  const url = `http://localhost:${port}`;
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: url, uncachedEdgeURL: url, siteID: "test-site", token })).toString("base64");
  process.env.CACHE_BACKEND = "blobs";
  cache = await import("@/lib/cache");
});

afterAll(async () => {
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
});

describe("blobs shared store", () => {
  it("round-trips values and skips the memory layer for shared reads", async () => {
    expect(cache.hasSharedStore()).toBe(true);
    await cache.sharedSet("job:abc", { events: [1, 2], done: false }, 60);
    expect(await cache.sharedGet("job:abc")).toEqual({ events: [1, 2], done: false });
    await cache.sharedSet("job:abc", { events: [1, 2, 3], done: true }, 60);
    expect(await cache.sharedGet("job:abc")).toEqual({ events: [1, 2, 3], done: true });
  });

  it("creates a key only once until it expires", async () => {
    expect(await cache.sharedCreate("inflight:x", { jobId: "a" }, 60)).toBe(true);
    expect(await cache.sharedCreate("inflight:x", { jobId: "b" }, 60)).toBe(false);
    expect(await cache.sharedGet("inflight:x")).toEqual({ jobId: "a" });
    await cache.sharedDelete("inflight:x");
    expect(await cache.sharedGet("inflight:x")).toBeUndefined();
    // An expired marker (a runner that died) can be taken over.
    expect(await cache.sharedCreate("inflight:y", { jobId: "old" }, -1)).toBe(true);
    expect(await cache.sharedGet("inflight:y")).toBeUndefined();
    expect(await cache.sharedCreate("inflight:y", { jobId: "new" }, 60)).toBe(true);
    expect(await cache.sharedGet("inflight:y")).toEqual({ jobId: "new" });
  });

  it("counts for rate limits", async () => {
    expect(await cache.incrWithTtl("ip10:1.2.3.4", 600)).toBe(1);
    expect(await cache.incrWithTtl("ip10:1.2.3.4", 600)).toBe(2);
    expect(await cache.peekCounter("ip10:1.2.3.4")).toBe(2);
    expect(await cache.peekCounter("ip10:5.6.7.8")).toBe(0);
  });

  it("caches through memory and the shared store", async () => {
    await cache.cacheSet("q:n1:test", { a: 1 }, 60);
    expect(await cache.cacheGet("q:n1:test")).toEqual({ a: 1 });
    expect(await cache.sharedGet("q:n1:test")).toEqual({ a: 1 });
  });
});
