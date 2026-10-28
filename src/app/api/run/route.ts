// Server-Sent Events stream of one agent run: trace steps, partial results,
// pitches, and the final result. Cached runs replay instantly and don't count
// against rate limits.
import { parseExclusions } from "@/lib/safety";
import { checkRunLimit, clientIp, countGlobalRun } from "@/lib/ratelimit";
import { getCachedRun, isInflight, runKey, startOrJoin } from "@/lib/runs";
import { dataMode, llmLabel } from "@/lib/config";
import type { RunEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const enc = new TextEncoder();
const frame = (e: RunEvent) => enc.encode(`data: ${JSON.stringify(e)}\n\n`);

function sseResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function oneShot(events: RunEvent[]) {
  return sseResponse(
    new ReadableStream({
      start(c) {
        for (const e of events) c.enqueue(frame(e));
        c.close();
      },
    }),
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const podcastId = url.searchParams.get("id")?.slice(0, 160) || undefined;
  const nameHint = url.searchParams.get("name")?.slice(0, 160) || undefined;
  const query = url.searchParams.get("q")?.slice(0, 160) || undefined;
  const exclude = parseExclusions(url.searchParams.get("x"));
  const fresh = url.searchParams.get("fresh") === "1";
  if (!podcastId && !query) return oneShot([{ type: "error", message: "Pick a podcast to analyse.", code: "BAD_REQUEST" }]);

  const input = { podcastId, nameHint, query, exclude };
  const key = runKey(input);

  // Cached result: replay the trace quickly, then deliver the result.
  const cached = fresh ? undefined : await getCachedRun(key);
  if (cached) {
    return sseResponse(
      new ReadableStream({
        async start(c) {
          c.enqueue(frame({ type: "meta", mode: cached.mode, llm: cached.llm, runId: cached.runId, cached: true }));
          for (const step of cached.trace) {
            c.enqueue(frame({ type: "step", step }));
            await new Promise((r) => setTimeout(r, 18));
          }
          c.enqueue(frame({ type: "done", result: cached }));
          c.close();
        },
      }),
    );
  }

  // Fresh run: rate-limit unless we're joining one that's already running.
  if (!isInflight(key)) {
    const limit = await checkRunLimit(clientIp(req));
    if (!limit.ok) {
      return oneShot([
        { type: "meta", mode: dataMode(), llm: llmLabel(), runId: "limited", cached: false },
        { type: "error", message: limit.message ?? "Rate limited", code: "RATE_LIMITED" },
      ]);
    }
    await countGlobalRun();
  }

  let unsubscribe: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe?.();
        try {
          c.close();
        } catch {
          /* already closed */
        }
      };
      ping = setInterval(() => {
        try {
          c.enqueue(enc.encode(": ping\n\n"));
        } catch {
          close();
        }
      }, 10_000);
      unsubscribe = startOrJoin(key, input, (e) => {
        if (closed) return;
        try {
          c.enqueue(frame(e));
        } catch {
          close();
          return;
        }
        if (e.type === "done" || e.type === "error") close();
      });
    },
    cancel() {
      clearInterval(ping);
      unsubscribe?.();
    },
  });
  return sseResponse(stream);
}
