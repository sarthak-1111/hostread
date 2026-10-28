// Starts a sponsor-deck run, or returns the cached deck. The browser then polls
// /api/run/events for the job's trace and results. Cached decks and joined
// runs don't count against rate limits.
import { NextResponse } from "next/server";
import { parseExclusions } from "@/lib/safety";
import { checkRunLimit, clientIp, countGlobalRun } from "@/lib/ratelimit";
import { currentJob, getCachedRun, runKey, startJob } from "@/lib/runs";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
/** How often the browser should poll; a shared store costs a request per poll. */
const pollMs = () => (config.run.execution === "background" ? 1000 : 400);

export async function POST(req: Request) {
  const url = new URL(req.url);
  const podcastId = url.searchParams.get("id")?.slice(0, 160) || undefined;
  const nameHint = url.searchParams.get("name")?.slice(0, 160) || undefined;
  const query = url.searchParams.get("q")?.slice(0, 160) || undefined;
  const exclude = parseExclusions(url.searchParams.get("x"));
  const fresh = url.searchParams.get("fresh") === "1";
  if (!podcastId && !query) return NextResponse.json({ error: "Pick a podcast to analyse.", code: "BAD_REQUEST" }, { status: 400, headers: noStore });

  const input = { podcastId, nameHint, query, exclude };
  const key = runKey(input);

  const cached = fresh ? undefined : await getCachedRun(key);
  if (cached) return NextResponse.json({ cached: true, result: cached }, { headers: noStore });

  try {
    const running = await currentJob(key);
    if (running) return NextResponse.json({ jobId: running, joined: true, pollMs: pollMs() }, { headers: noStore });

    const limit = await checkRunLimit(clientIp(req));
    if (!limit.ok) {
      return NextResponse.json(
        { error: limit.message ?? "Rate limited", code: "RATE_LIMITED" },
        { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSec ?? 600) } },
      );
    }
    const job = await startJob(key, input, url.origin);
    if (!job.joined) await countGlobalRun();
    return NextResponse.json({ jobId: job.jobId, joined: job.joined, pollMs: pollMs() }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "The server couldn't start the analysis. Please try again in a moment.", code: "START_FAILED" }, { status: 503, headers: noStore });
  }
}
