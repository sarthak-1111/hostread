// Podcast autocomplete (Qloo /search, type urn:entity:podcast), cached and rate-limited.
import { NextResponse } from "next/server";
import { TasteClient } from "@/lib/qloo/client";
import { checkSimpleLimit, clientIp } from "@/lib/ratelimit";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const limit = await checkSimpleLimit("search", clientIp(req), config.limits.searchesPerIpPerMin, 60);
  if (!limit.ok) return NextResponse.json({ results: [], error: limit.message }, { status: 429 });
  try {
    const client = new TasteClient();
    const results = await client.searchPodcasts(q, 8);
    return NextResponse.json({
      mode: client.mode,
      results: results.map((r) => ({ id: r.id, name: r.name, subtitle: r.subtitle, image: r.image, genres: r.genres, sample: r.sample })),
    });
  } catch {
    return NextResponse.json({ results: [], error: "Search is unavailable right now." }, { status: 502 });
  }
}
