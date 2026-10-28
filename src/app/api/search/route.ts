// Autocomplete (Qloo /search): podcasts by default, brands with ?type=brand.
// Cached and rate-limited.
import { NextResponse } from "next/server";
import { TasteClient } from "@/lib/qloo/client";
import { checkSimpleLimit, clientIp } from "@/lib/ratelimit";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const limit = await checkSimpleLimit("search", clientIp(req), config.limits.searchesPerIpPerMin, 60);
  if (!limit.ok) return NextResponse.json({ results: [], error: limit.message }, { status: 429 });
  try {
    const client = new TasteClient();
    if (params.get("type") === "brand") {
      const brands = await client.searchBrands(q, 8);
      return NextResponse.json({
        mode: client.mode,
        results: brands.map((b) => ({ id: b.id, name: b.name, subtitle: b.category, image: b.image, sample: b.sample })),
      });
    }
    const results = await client.searchPodcasts(q, 8);
    return NextResponse.json({
      mode: client.mode,
      results: results.map((r) => ({ id: r.id, name: r.name, subtitle: r.subtitle, image: r.image, genres: r.genres, sample: r.sample })),
    });
  } catch {
    return NextResponse.json({ results: [], error: "Search is unavailable right now." }, { status: 502 });
  }
}
