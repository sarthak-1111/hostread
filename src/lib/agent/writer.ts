// Pitch email + host-read ad script, grounded in this run's taste data.
//
// Grounding rule: the text may only cite entities the taste API returned for
// this run. We check every candidate reference in code (lib/grounding.ts),
// regenerate with feedback when the model invents one, and fall back to a
// deterministic template if it keeps doing so or the LLM is unavailable.
import "server-only";
import { DOMAINS } from "../domains";
import { checkGrounding, readSeconds, wordCount } from "../grounding";
import type { LlmClient } from "../llm/client";
import type { Demographics, DomainKey, GeoPoint, PitchPack, PodcastEntity, SharedEntity, SponsorCard, TasteEntity } from "../types";

export interface WriterInput {
  podcast: PodcastEntity;
  card: SponsorCard;
  profile: Map<DomainKey, TasteEntity[]>;
  demographics?: Demographics | null;
  geography?: GeoPoint[] | null;
}

const MAX_ATTEMPTS = 3;

export function allowedReferences(input: WriterInput): string[] {
  const refs = new Set<string>();
  for (const s of input.card.evidence.slice(0, 15)) refs.add(s.entity.name);
  for (const [, list] of input.profile) for (const e of list.slice(0, 4)) refs.add(e.name);
  for (const g of input.geography ?? []) refs.add(g.name);
  return [...refs];
}

function alwaysAllowed(input: WriterInput): string[] {
  const { podcast, card } = input;
  return [podcast.name, card.brand.name, card.brand.category ?? "", ...(podcast.genres ?? []), "Qloo", "HostRead", "Gen Z", "Millennials", "Fit Score"].filter(Boolean);
}

function demoLine(d?: Demographics | null): string | undefined {
  if (!d) return undefined;
  const age = Object.entries(d.age).sort((a, b) => b[1] - a[1])[0];
  const gender = Object.entries(d.gender).sort((a, b) => b[1] - a[1])[0];
  const parts: string[] = [];
  if (age && age[1] > 0.05) parts.push(`over-indexes age ${age[0].replace(/_/g, " ")}`);
  if (gender && gender[1] > 0.05) parts.push(`skews ${gender[0]}`);
  return parts.length ? parts.join(", ") : undefined;
}

function buildPrompt(input: WriterInput, allowed: string[], feedback?: string) {
  const { podcast, card } = input;
  const evidence = card.evidence
    .slice(0, 8)
    .map((s) => `- ${s.entity.name} (${DOMAINS[s.domain].label})`)
    .join("\n");
  const listenerTop = [...input.profile.entries()]
    .filter(([, l]) => l.length)
    .map(([d, l]) => `${DOMAINS[d].label}: ${l.slice(0, 3).map((e) => e.name).join(", ")}`)
    .join("; ");
  const demo = demoLine(input.demographics);
  const system =
    "You write sponsorship materials for independent podcast hosts. GROUNDING RULE: the only cultural references you may mention " +
    "(films, TV shows, artists, books, restaurants, places, podcasts, celebrities) are the ones in ALLOWED REFERENCES — copy their names exactly. " +
    "Never mention any other title, artist, celebrity, place or brand. Never invent statistics, download numbers, prices or product claims. " +
    "Use the placeholders [Host Name], [URL] and [PROMO CODE], and [personal experience] where the host should add a sentence about using the product.";
  const user =
    `PODCAST: ${podcast.name}${podcast.genres?.length ? ` (${podcast.genres.join(", ")})` : ""}\n` +
    `BRAND: ${card.brand.name}${card.brand.category ? ` (category: ${card.brand.category})` : ""}\n` +
    (card.brand.description ? `BRAND DESCRIPTION (from the taste graph): ${card.brand.description}\n` : "") +
    (card.fit ? `FIT SCORE: ${card.fit}/100 (a relative ranking within this show's sponsor deck, not a sales forecast)\n` : "") +
    `SHARED FAVOURITES — this show's listeners and ${card.brand.name}'s fans both love:\n${evidence || "- (none found)"}\n` +
    (listenerTop ? `LISTENERS ALSO LOVE: ${listenerTop}\n` : "") +
    (demo ? `AUDIENCE: ${demo}\n` : "") +
    `ALLOWED REFERENCES: ${allowed.map((a) => `"${a}"`).join(", ")}\n\n` +
    `Write exactly three sections with these headers:\n` +
    `### SUBJECT\nOne email subject line.\n` +
    `### EMAIL\nA 120–170 word pitch email from the host to ${card.brand.name}'s partnerships team. Cite 2–3 shared favourites as evidence that the audiences overlap. ` +
    `Propose a small test (for example three host-read mid-rolls with a tracked promo code). Sign off as [Host Name].\n` +
    `### AD SCRIPT\nA 45–60 second host-read ad (110–150 words), first person and conversational, that weaves in one or two shared favourites naturally, ` +
    `describes ${card.brand.name} only in general terms, includes [personal experience], and ends with [URL] and [PROMO CODE].\n` +
    (feedback ? `\nIMPORTANT — fix this in your rewrite: ${feedback}\n` : "");
  return { system, user };
}

export function parseSections(text: string): { subject: string; email: string; adScript: string } | null {
  const grab = (name: string) => {
    const re = new RegExp(`#{2,4}\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n#{2,4}\\s*(SUBJECT|EMAIL|AD SCRIPT)\\b|$)`, "i");
    return text.match(re)?.[1]?.trim() ?? "";
  };
  const subject = grab("SUBJECT").split("\n")[0].replace(/^subject:\s*/i, "").replace(/^["*]+|["*]+$/g, "").trim();
  const email = grab("EMAIL");
  const adScript = grab("AD SCRIPT");
  if (!subject || email.length < 60 || adScript.length < 60) return null;
  return { subject, email, adScript };
}

export async function writePitch(llm: LlmClient | null, input: WriterInput, signal?: AbortSignal): Promise<PitchPack> {
  const allowed = allowedReferences(input);
  const always = alwaysAllowed(input);
  const rejected: string[] = [];
  let feedback: string | undefined;
  if (llm) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let text: string;
      try {
        const { system, user } = buildPrompt(input, allowed, feedback);
        text = await llm.complete(
          [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          { temperature: attempt === 1 ? 0.7 : 0.4, maxTokens: 2200, signal },
        );
      } catch {
        break; // LLM unavailable -> template
      }
      const parts = parseSections(text);
      if (!parts) {
        feedback = "Use exactly the three headers ### SUBJECT, ### EMAIL and ### AD SCRIPT.";
        continue;
      }
      const g = checkGrounding(`${parts.subject}\n${parts.email}\n${parts.adScript}`, allowed, always);
      const words = wordCount(parts.adScript);
      if (!g.ok) {
        rejected.push(...g.offenders);
        feedback = `You mentioned ${g.offenders.map((o) => `"${o}"`).join(", ")}, which ${g.offenders.length === 1 ? "is" : "are"} not in ALLOWED REFERENCES. Remove ${g.offenders.length === 1 ? "it" : "them"} and use only allowed references.`;
        continue;
      }
      if ((words < 95 || words > 175) && attempt < MAX_ATTEMPTS) {
        feedback = `The ad script was ${words} words; it must be 110–150 words.`;
        continue;
      }
      return { ...parts, references: g.cited, source: "llm", attempts: attempt, adWords: words, adSeconds: readSeconds(words), rejected: rejected.length ? [...new Set(rejected)] : undefined };
    }
  }
  return templatePitch(input, rejected);
}

// ---- deterministic template (always grounded) ------------------------------

const PHRASE: Record<DomainKey, (n: string) => string> = {
  film: (n) => `who can quote ${n} from memory`,
  tv: (n) => `who binged ${n} in a weekend`,
  music: (n) => `who has ${n} on repeat`,
  books: (n) => `with ${n} on the nightstand`,
  dining: (n) => `who would cross town for ${n}`,
  travel: (n) => `already daydreaming about ${n}`,
  podcasts: (n) => `who also never miss ${n}`,
};

function listJoin(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

export function templatePitch(input: WriterInput, rejected: string[] = []): PitchPack {
  const { podcast, card } = input;
  const ev: SharedEntity[] = card.topEvidence.length ? card.topEvidence : card.evidence.slice(0, 3);
  const evidenceList = listJoin(ev.map((e) => `${e.entity.name} (${DOMAINS[e.domain].label.toLowerCase()})`));
  const genre = podcast.genres?.[0]?.toLowerCase();
  const subject = `${podcast.name} × ${card.brand.name}: a sponsor fit backed by taste data`;
  const email = [
    `Hi ${card.brand.name} partnerships team,`,
    ``,
    `I host ${podcast.name}${genre ? `, a ${genre} show` : ""}. We mapped our audience's taste with HostRead, which uses Qloo's taste graph, and ${card.brand.name} came out as ${card.rank === 1 ? "the strongest" : "one of the strongest"} sponsor fits for our listeners${card.rank ? ` (#${card.rank} in our fit ranking)` : ""}.`,
    ``,
    ev.length
      ? `The overlap is specific: our listeners and your fans share a love of ${evidenceList}. That's the kind of audience that hears a host-read recommendation as advice from a friend.`
      : `Our listeners show a strong affinity for ${card.brand.name} in the taste data.`,
    ``,
    `I'd love to run a small test: three host-read mid-rolls across upcoming episodes, written in my own voice, with a dedicated [PROMO CODE] so you can measure response directly.`,
    ``,
    `Open to a quick call next week? I can send our one-page media kit.`,
    ``,
    `Thanks,`,
    `[Host Name]`,
    `${podcast.name}`,
  ].join("\n");
  const hooks = ev.slice(0, 2).map((e) => PHRASE[e.domain](e.entity.name));
  const adScript = [
    `Quick break, because this one actually fits.`,
    hooks.length
      ? `If you've been listening for a while, I know who you are. You're the person ${listJoin(hooks)}. Turns out a lot of you love ${card.brand.name}, too, and honestly, that tracks.`
      : `A lot of you already love ${card.brand.name}, and honestly, that tracks.`,
    `[personal experience]`,
    `What I like about ${card.brand.name} is that it doesn't try to be everything. It does its thing well, and it fits into a life like yours without fuss.`,
    `So here's the deal: head to [URL] and use code [PROMO CODE] at checkout. It helps the show, and it tells ${card.brand.name} that ${podcast.name} listeners have great taste. Which you do.`,
    `That's [URL], code [PROMO CODE]. Now, back to the episode.`,
  ].join("\n\n");
  const words = wordCount(adScript);
  return {
    subject,
    email,
    adScript,
    references: ev.map((e) => e.entity.name),
    source: "template",
    attempts: 0,
    adWords: words,
    adSeconds: readSeconds(words),
    rejected: rejected.length ? [...new Set(rejected)] : undefined,
  };
}
