// Brand-side mode: podcasts whose listeners already love a brand. Deterministic
// (Qloo + code, no LLM), so one request computes the whole result in seconds.
// Cached results don't count against rate limits; concurrent requests for the
// same brand on one instance share a single computation.
import { NextResponse } from "next/server";
import { BrandMatchError, brandMatchKey, computeBrandMatch, findBrand } from "@/lib/brandside";
import { checkRunLimit, clientIp, countGlobalRun } from "@/lib/ratelimit";
import { getCachedResult, saveResult } from "@/lib/runs";
import { BudgetExceededError, QlooError } from "@/lib/qloo/client";
import type { BrandMatchResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };
const inflight = new Map<string, Promise<BrandMatchResult>>();

const fail = (error: string, code: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ error, code }, { status, headers: { ...noStore, ...extra } });

export async function GET(req: Request) {
  const url = new URL(req.url);
  let brandId = url.searchParams.get("id")?.slice(0, 160) || undefined;
  let nameHint = url.searchParams.get("name")?.slice(0, 160) || undefined;
  const query = url.searchParams.get("q")?.trim().slice(0, 80) || undefined;
  if (!brandId && !query) return fail("Pick a brand to match.", "BAD_REQUEST", 400);

  try {
    if (!brandId) {
      const hit = await findBrand(query!);
      if (!hit) return fail(`No brand called “${query}” in the taste graph.`, "NOT_FOUND", 404);
      brandId = hit.id;
      nameHint = hit.name;
    }
    const key = brandMatchKey(brandId);
    const cached = await getCachedResult<BrandMatchResult>(key);
    if (cached) return NextResponse.json({ cached: true, result: cached }, { headers: noStore });

    let job = inflight.get(key);
    if (!job) {
      const limit = await checkRunLimit(clientIp(req));
      if (!limit.ok) return fail(limit.message ?? "Rate limited", "RATE_LIMITED", 429, { "Retry-After": String(limit.retryAfterSec ?? 600) });
      await countGlobalRun();
      const id = brandId;
      job = computeBrandMatch(id, nameHint).then(async (result) => {
        await saveResult(key, result).catch(() => undefined);
        return result;
      });
      inflight.set(key, job);
      void job.finally(() => inflight.delete(key)).catch(() => undefined);
    }
    return NextResponse.json({ cached: false, result: await job }, { headers: noStore });
  } catch (err) {
    if (err instanceof BrandMatchError) return fail(err.message, err.code, err.code === "NOT_FOUND" ? 404 : 422);
    if (err instanceof QlooError && err.code === "QLOO_RATE_LIMIT") return fail(err.message, err.code, 429, { "Retry-After": "30" });
    if (err instanceof BudgetExceededError) return fail("This match needed more taste-data calls than allowed. Please try again.", "BUDGET", 503);
    return fail("The taste graph didn't answer in time. Please try again in a moment.", "UPSTREAM", 502);
  }
}
