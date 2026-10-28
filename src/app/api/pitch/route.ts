// On-demand pitch email + ad script for a brand further down the deck.
// Evidence is always rebuilt server-side from this show's taste data (cached
// run, or cached API responses), never taken from the browser.
import { NextResponse } from "next/server";
import { z } from "zod";
import { newState, type RunContext } from "@/lib/agent/context";
import { computeOverlaps, loadCandidates, loadFanProfiles, loadProfile, setPodcast } from "@/lib/agent/stages";
import { writePitch } from "@/lib/agent/writer";
import { config } from "@/lib/config";
import { LlmClient } from "@/lib/llm/client";
import { TasteClient } from "@/lib/qloo/client";
import { checkSimpleLimit, clientIp } from "@/lib/ratelimit";
import { getCachedRun, runKey, saveRun } from "@/lib/runs";
import { parseExclusions } from "@/lib/safety";
import { pickTopEvidence } from "@/lib/scoring";
import type { DomainKey, SponsorCard, TasteEntity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  podcastId: z.string().min(1).max(160),
  brandId: z.string().min(1).max(160),
  name: z.string().max(160).optional(),
  x: z.string().max(200).optional(),
  /** Display-only: the card's fit from the deck the user is looking at. */
  fit: z.number().min(0).max(100).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { podcastId, brandId, name, x, fit } = parsed.data;
  const exclude = parseExclusions(x);
  const key = runKey({ podcastId, nameHint: name, exclude });
  const cached = await getCachedRun(key);
  const cachedCard = cached?.deck.find((c) => c.brand.id === brandId);
  if (cachedCard?.pitch) return NextResponse.json({ pitch: cachedCard.pitch });

  const limit = await checkSimpleLimit("pitch", clientIp(req), config.limits.pitchesPerIpPer10Min, 600);
  if (!limit.ok) return NextResponse.json({ error: limit.message }, { status: 429 });

  try {
    const llm = new LlmClient();
    if (cached && cachedCard) {
      const profile = new Map<DomainKey, TasteEntity[]>(cached.profile.map((p) => [p.domain, p.entities]));
      const pitch = await writePitch(llm, { podcast: cached.podcast, card: cachedCard, profile, demographics: cached.demographics, geography: cached.geography }, req.signal);
      cachedCard.pitch = pitch;
      await saveRun(key, cached);
      return NextResponse.json({ pitch });
    }

    // No cached run on this instance: rebuild this brand's evidence from (cached) API data.
    const ctx: RunContext = {
      runId: "pitch",
      qloo: new TasteClient(40),
      llm,
      emit: () => {},
      signal: req.signal,
      exclude,
      state: newState(),
      trace: [],
      fallbacks: [],
      startedAt: Date.now(),
      llmOk: true,
    };
    const podcast = await ctx.qloo.getPodcast(podcastId, name);
    if (!podcast) return NextResponse.json({ error: "Show not found" }, { status: 404 });
    setPodcast(ctx, podcast);
    await loadProfile(ctx);
    const cands = await loadCandidates(ctx);
    const brand = cands.find((b) => b.id === brandId);
    if (!brand) return NextResponse.json({ error: "That brand isn't in this show's deck any more. Re-run the analysis." }, { status: 404 });
    await loadFanProfiles(ctx, [brand]);
    const overlap = computeOverlaps(ctx, [brand.id])[0];
    const card: SponsorCard = {
      rank: 0,
      brand,
      fit: Math.round(fit ?? 0),
      score: { affinity: 0, overlap: 0, surprise: 0, rawOverlap: overlap?.raw ?? 0 },
      surpriseFit: false,
      evidence: overlap?.shared.slice(0, 24) ?? [],
      topEvidence: pickTopEvidence(overlap?.shared ?? [], 3),
      perDomain: overlap?.perDomain ?? {},
    };
    const pitch = await writePitch(llm, { podcast, card, profile: ctx.state.profile }, req.signal);
    return NextResponse.json({ pitch });
  } catch {
    return NextResponse.json({ error: "Couldn't write the pitch right now. Please try again." }, { status: 502 });
  }
}
