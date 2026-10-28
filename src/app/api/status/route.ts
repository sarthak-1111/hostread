import { NextResponse } from "next/server";
import { config, dataMode, llmLabel } from "@/lib/config";
import { qlooMonthlyRemaining } from "@/lib/qloo/client";

export const dynamic = "force-dynamic";

// Deployment check: which data mode, LLM and run setup this instance uses.
// Reports whether secrets are configured, never their values.
export async function GET() {
  return NextResponse.json(
    {
      mode: dataMode(),
      llm: llmLabel(),
      execution: config.run.execution,
      store: config.cache.backend || (config.cache.kvUrl ? "kv" : "memory"),
      deckArchive: process.env.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : "none",
      // As last reported to this instance; absent until it has made a Qloo call.
      qlooMonthlyRemaining: qlooMonthlyRemaining() ?? null,
      configured: {
        qlooKey: Boolean(process.env.QLOO_API_KEY),
        llmKey: Boolean(config.llm.apiKey),
        jobSecret: Boolean(config.run.jobSecret),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
