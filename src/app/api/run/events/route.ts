// Poll a running job: returns the events after `from`, and whether the job is
// finished. Events are the same ones the agent emits (trace steps, partial
// results, pitches, the final result).
import { NextResponse } from "next/server";
import { STALE_MS, isJobId, readJob } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const job = url.searchParams.get("job") ?? "";
  if (!isJobId(job)) return NextResponse.json({ error: "Bad job id" }, { status: 400, headers: noStore });
  const from = Math.max(0, Math.floor(Number(url.searchParams.get("from")) || 0));
  try {
    const log = await readJob(job);
    if (!log) return NextResponse.json({ found: false, events: [], next: from, done: false }, { headers: noStore });
    const events = log.events.slice(from);
    return NextResponse.json(
      { found: true, events, next: from + events.length, done: log.done, stale: !log.done && Date.now() - log.at > STALE_MS },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json({ error: "Couldn't read the job" }, { status: 503, headers: noStore });
  }
}
