// Per-IP rate limits and a daily global cap, so judges can't (accidentally)
// exhaust the API keys. Cached runs never count against these.
import "server-only";
import { config } from "./config";
import { incrWithTtl, peekCounter } from "./cache";

export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || h.get("cf-connecting-ip") || "local";
}

export interface LimitResult {
  ok: boolean;
  message?: string;
  retryAfterSec?: number;
}

const day = () => new Date().toISOString().slice(0, 10);

export async function checkRunLimit(ip: string): Promise<LimitResult> {
  const global = await peekCounter(`global:${day()}`);
  if (global >= config.limits.globalRunsPerDay) {
    return {
      ok: false,
      message:
        "HostRead has hit its daily budget of fresh analyses. Cached shows (like the examples on the home page) still work instantly — please try a new show tomorrow.",
      retryAfterSec: 3600,
    };
  }
  const short = await incrWithTtl(`ip10:${ip}`, 600);
  if (short > config.limits.runsPerIpPer10Min) {
    return {
      ok: false,
      message: "You're running analyses faster than we can pour coffee. Give it a few minutes, or open one of the example shows — those are cached and instant.",
      retryAfterSec: 600,
    };
  }
  const daily = await incrWithTtl(`ipday:${ip}:${day()}`, 86_400);
  if (daily > config.limits.runsPerIpPerDay) {
    return { ok: false, message: "You've reached today's limit of fresh analyses from this network. Cached shows still work.", retryAfterSec: 3600 };
  }
  return { ok: true };
}

/** Called once a fresh (uncached) run actually starts. */
export async function countGlobalRun(): Promise<void> {
  await incrWithTtl(`global:${day()}`, 86_400 * 2);
}

export async function checkSimpleLimit(bucket: string, ip: string, max: number, windowSec: number): Promise<LimitResult> {
  const n = await incrWithTtl(`${bucket}:${ip}`, windowSec);
  if (n > max) return { ok: false, message: "Slow down a little — too many requests in a short time.", retryAfterSec: windowSec };
  return { ok: true };
}
